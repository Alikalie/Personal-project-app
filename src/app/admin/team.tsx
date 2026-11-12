import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Search, Shield, UserPlus, X } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminInitials, AdminLoading, AdminScreen, AdminStatusBadge, formatAdminDate } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  grantPlatformAdmin,
  listAdminUsers,
  listPlatformAdmins,
  revokePlatformAdmin,
  type AdminTeamMember,
  type AdminUserRow,
} from '@/services/adminService';

type AdminLevel = 'support' | 'super_admin';

export default function AdminTeam() {
  const { ctx } = useAuth();
  const allowed = ctx?.platformAdminLevel === 'super_admin';
  const [admins, setAdmins] = useState<AdminTeamMember[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [newLevel, setNewLevel] = useState<AdminLevel>('support');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (!allowed) router.replace('/admin');
  }, [allowed]);

  const load = useCallback(async () => {
    if (!allowed || lock.current) return;
    lock.current = true;
    setLoading(true);
    setError('');
    try {
      setAdmins(await listPlatformAdmins());
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }, [allowed]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    if (!showAdd || !debouncedSearch) {
      setUsers([]);
      setSearching(false);
      return () => {
        active = false;
      };
    }
    setSearching(true);
    setActionError('');
    void listAdminUsers(debouncedSearch, 30, 0).then((rows) => {
      if (active) setUsers(rows.filter((user) => !user.platform_level));
    }).catch((searchError: unknown) => {
      if (active) setActionError(friendlyErrorMessage(searchError, 'admin'));
    }).finally(() => {
      if (active) setSearching(false);
    });
    return () => {
      active = false;
    };
  }, [debouncedSearch, showAdd]);

  const confirmGrant = (user: AdminUserRow, level: AdminLevel) => {
    Alert.alert('Grant admin access?', `Make ${user.full_name} a ${level === 'super_admin' ? 'super admin' : 'support admin'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Grant access',
        onPress: () => {
          setSaving(true);
          setActionError('');
          void grantPlatformAdmin(user.user_id, level).then(async () => {
            setShowAdd(false);
            setSearch('');
            setSelectedUser(null);
            await load();
          }).catch((grantError: unknown) => {
            setActionError(friendlyErrorMessage(grantError, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const changeLevel = (admin: AdminTeamMember, level: AdminLevel) => {
    if (admin.user_id === ctx?.id || saving || admin.level === level) return;
    Alert.alert('Change admin level?', `Change ${admin.full_name} to ${level === 'super_admin' ? 'super admin' : 'support'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change level',
        onPress: () => {
          setSaving(true);
          setActionError('');
          void grantPlatformAdmin(admin.user_id, level).then(load).catch((failure: unknown) => {
            setActionError(friendlyErrorMessage(failure, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const removeAdmin = (admin: AdminTeamMember) => {
    if (admin.user_id === ctx?.id || saving) return;
    Alert.alert('Remove admin access?', `Remove admin access from ${admin.full_name}?`, [
      { text: 'Keep access', style: 'cancel' },
      {
        text: 'Remove access',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          setActionError('');
          void revokePlatformAdmin(admin.user_id).then(load).catch((failure: unknown) => {
            setActionError(friendlyErrorMessage(failure, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  if (!allowed) return <AdminScreen title="Admin team"><Text style={styles.muted}>Only super admins can manage the admin team.</Text></AdminScreen>;

  return (
    <AdminScreen
      title="Admin team"
      subtitle="Super admin access only"
      rightAction={<Pressable style={styles.addButton} onPress={() => setShowAdd(true)} accessibilityRole="button"><UserPlus size={19} color={colors.white} /></Pressable>}
    >
      {error && admins.length === 0 ? <AdminError message={error} onRetry={() => void load()} /> : loading && admins.length === 0 ? (
        <AdminLoading rows={4} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          {admins.length === 0 ? <Text style={styles.muted}>No platform admins found.</Text> : admins.map((admin) => {
            const self = admin.user_id === ctx?.id;
            return (
              <AdminCard key={admin.user_id}>
                <View style={styles.adminIdentity}>
                  <AdminInitials name={admin.full_name} />
                  <View style={styles.adminCopy}>
                    <Text style={styles.adminName}>{admin.full_name}{self ? ' (you)' : ''}</Text>
                    <Text style={styles.muted}>{admin.email}</Text>
                    <Text style={styles.code}>{admin.profile_code}</Text>
                  </View>
                  <AdminStatusBadge label={admin.level === 'super_admin' ? 'Super admin' : 'Support'} tone="warning" />
                </View>
                <Text style={styles.dateText}>Last sign-in: {formatAdminDate(admin.last_sign_in_at)}</Text>
                <Text style={styles.dateText}>Joined: {formatAdminDate(admin.created_at)}</Text>
                {!self ? (
                  <View style={styles.actions}>
                    <Action label="Make support" onPress={() => changeLevel(admin, 'support')} disabled={saving || admin.level === 'support'} />
                    <Action label="Make super admin" onPress={() => changeLevel(admin, 'super_admin')} disabled={saving || admin.level === 'super_admin'} />
                    <Action label="Remove access" onPress={() => removeAdmin(admin)} danger disabled={saving} />
                  </View>
                ) : <Text style={styles.muted}>You cannot remove your own admin access.</Text>}
              </AdminCard>
            );
          })}
        </ScrollView>
      )}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setShowAdd(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => !saving && setShowAdd(false)} accessibilityRole="button" accessibilityLabel="Close add admin" />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetTitle}>Add admin</Text>
                <Text style={styles.muted}>Find a user by email or USR code.</Text>
              </View>
              <Pressable onPress={() => setShowAdd(false)} disabled={saving} style={styles.closeButton} accessibilityRole="button"><X size={20} color={colors.text} /></Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Email or USR code" placeholderTextColor={colors.textSecondary} style={styles.searchInput} autoCapitalize="none" accessibilityLabel="Search users by email or profile code" />
            </View>
            <View style={styles.levelChoice}>
              {(['support', 'super_admin'] as const).map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setNewLevel(level)}
                  style={[styles.levelButton, newLevel === level && styles.levelSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newLevel === level }}
                >
                  <Text style={[styles.levelText, newLevel === level && styles.levelTextSelected]}>{level === 'super_admin' ? 'Super admin' : 'Support'}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {!search.trim() ? <Text style={styles.muted}>Enter an email or profile code to search.</Text> : searching ? <ActivityIndicator color={colors.primary} /> : users.length === 0 ? <Text style={styles.muted}>No matching non-admin users.</Text> : users.map((user) => (
                <Pressable
                  key={user.user_id}
                  onPress={() => setSelectedUser(user)}
                  style={[styles.userOption, selectedUser?.user_id === user.user_id && styles.userOptionSelected]}
                  accessibilityRole="button"
                >
                  <View style={styles.userOptionCopy}>
                    <Text style={styles.adminName}>{user.full_name}</Text>
                    <Text style={styles.muted}>{user.email}</Text>
                    <Text style={styles.code}>{user.profile_code}</Text>
                  </View>
                  {selectedUser?.user_id === user.user_id ? <Shield size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            <Button
              label={saving ? 'Adding admin…' : `Add as ${newLevel === 'super_admin' ? 'super admin' : 'support'}`}
              onPress={() => selectedUser && confirmGrant(selectedUser, newLevel)}
              loading={saving}
              disabled={!selectedUser || saving}
            />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

function Action({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, disabled && styles.disabled]} accessibilityRole="button">
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary },
  adminIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  adminCopy: { flex: 1, minWidth: 0 },
  adminName: { color: colors.text, ...typography.label },
  code: { color: colors.primaryDark, ...typography.caption },
  muted: { color: colors.textSecondary, ...typography.caption },
  dateText: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two },
  actionText: { color: colors.primaryDark, ...typography.caption },
  danger: { color: colors.danger },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, ...typography.caption },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: { maxHeight: '90%', paddingHorizontal: Spacing.five, paddingTop: Spacing.five, paddingBottom: Spacing.six, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background, gap: Spacing.three },
  sheetHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sheetCopy: { flex: 1 },
  sheetTitle: { color: colors.text, ...typography.heading },
  closeButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: 12 },
  searchWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, color: colors.text, ...typography.body },
  levelChoice: { flexDirection: 'row', gap: Spacing.two },
  levelButton: { minHeight: 44, flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  levelSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  levelText: { color: colors.textSecondary, ...typography.caption },
  levelTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  searchResults: { minHeight: 100, maxHeight: 300 },
  userOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, borderBottomWidth: 1, borderBottomColor: colors.border },
  userOptionSelected: { backgroundColor: colors.primaryLight },
  userOptionCopy: { flex: 1 },
});
