import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, Mail, Phone, Shield, UserRound } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminInitials, AdminLoading, AdminReason, AdminReasonModal, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  getAdminUserDetail,
  grantPlatformAdmin,
  refreshAdminOverview,
  revokePlatformAdmin,
  setAdminUserSuspended,
  type AdminUserDetail,
} from '@/services/adminService';

export default function AdminUserDetailScreen() {
  const { ctx } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('User details are not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setUser(await getAdminUserDetail(id));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const self = Boolean(ctx?.id && user?.user_id === ctx.id);
  const isAnotherAdmin = Boolean(user?.platform_level && !self);
  const canChangeStatus = Boolean(user && !self && (!isAnotherAdmin || superAdmin));
  const changeAdminLevel = async (level: 'support' | 'super_admin') => {
    if (!user || !superAdmin || saving) return;
    setSaving(true);
    setActionError('');
    try {
      await grantPlatformAdmin(user.user_id, level);
      await load();
    } catch (actionFailure) {
      setActionError(friendlyErrorMessage(actionFailure, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = () => {
    if (!user || !superAdmin || self || saving) return;
    Alert.alert('Remove admin access?', `Remove admin access from ${user.full_name}?`, [
      { text: 'Keep access', style: 'cancel' },
      {
        text: 'Remove access',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          setActionError('');
          void revokePlatformAdmin(user.user_id).then(load).catch((failure: unknown) => {
            setActionError(friendlyErrorMessage(failure, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', `${label} copied.`);
    } catch (copyError) {
      Alert.alert('Could not copy', friendlyErrorMessage(copyError));
    }
  };

  const toggleSuspension = async (reason: string) => {
    if (!user || !canChangeStatus) return;
    setSaving(true);
    setActionError('');
    try {
      await setAdminUserSuspended(user.user_id, !user.is_suspended, reason);
      setShowSuspend(false);
      await load();
    } catch (actionFailure) {
      setActionError(friendlyErrorMessage(actionFailure, 'admin'));
      throw actionFailure;
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title="User details">
      {loading && !user ? <AdminLoading rows={5} /> : error && !user ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : user ? (
        <ScrollView contentContainerStyle={styles.content}>
          {user.is_suspended ? (
            <View style={styles.suspendedBanner}>
              <Text style={styles.bannerTitle}>This account is suspended</Text>
              <AdminReason label={user.suspended_reason} />
            </View>
          ) : null}
          <AdminCard>
            <View style={styles.identity}>
              <AdminInitials name={user.full_name} />
              <View style={styles.identityText}>
                <Text style={styles.name}>{user.full_name}</Text>
                <Text style={styles.code}>{user.profile_code || 'USR code unavailable'}</Text>
              </View>
              <AdminStatusBadge label={user.is_suspended ? 'Suspended' : 'Active'} tone={user.is_suspended ? 'danger' : 'success'} />
            </View>
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Phone} label="Phone" value={user.phone || 'Not provided'} />
            <InfoRow icon={UserRound} label="Joined" value={dateLabel(user.created_at)} />
            <InfoRow icon={Shield} label="Last sign-in" value={dateLabel(user.last_sign_in_at)} />
            <View style={styles.copyActions}>
              <SmallAction label="Copy profile code" icon={Copy} onPress={() => void copy(user.profile_code, 'Profile code')} />
              <SmallAction label="Copy email" icon={Copy} onPress={() => void copy(user.email, 'Email')} />
            </View>
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Businesses</Text>
            {user.memberships.length === 0 ? <Text style={styles.muted}>No business memberships.</Text> : user.memberships.map((membership) => (
              <Pressable
                key={membership.business_id}
                onPress={() => router.push({ pathname: '/admin/business/[id]', params: { id: membership.business_id } })}
                style={styles.membership}
                accessibilityRole="button"
              >
                <View style={styles.membershipCopy}>
                  <Text style={styles.membershipName}>{membership.name}</Text>
                  <Text style={styles.code}>{membership.business_code}</Text>
                  <Text style={styles.muted}>{membership.role}</Text>
                </View>
                {membership.is_suspended ? <AdminStatusBadge label="Suspended" tone="danger" /> : null}
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Admin access</Text>
            {user.platform_level ? (
              <AdminStatusBadge
                label={user.platform_level === 'super_admin' ? 'Super admin' : 'Support'}
                tone="warning"
              />
            ) : <Text style={styles.muted}>This user is not an admin.</Text>}
            {superAdmin ? (
              <View style={styles.actions}>
                <SmallAction label="Make support admin" onPress={() => void changeAdminLevel('support')} disabled={saving || user.platform_level === 'support'} />
                <SmallAction label="Make super admin" onPress={() => void changeAdminLevel('super_admin')} disabled={saving || user.platform_level === 'super_admin'} />
                {user.platform_level && !self ? <SmallAction label="Remove admin access" danger onPress={removeAdmin} disabled={saving} /> : null}
                {self ? <Text style={styles.muted}>You cannot remove your own admin access.</Text> : null}
              </View>
            ) : (
              <Text style={styles.muted}>Only super admins can change admin access.</Text>
            )}
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Account status</Text>
            {self ? (
              <Text style={styles.muted}>You cannot suspend your own account.</Text>
            ) : isAnotherAdmin && !superAdmin ? (
              <Text style={styles.muted}>Only super admins can suspend another admin.</Text>
            ) : canChangeStatus ? (
              <Button
                label={user.is_suspended ? 'Unsuspend user' : 'Suspend user'}
                onPress={() => {
                  setActionError('');
                  setShowSuspend(true);
                }}
                variant={user.is_suspended ? 'outline' : 'primary'}
              />
            ) : null}
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          </AdminCard>
        </ScrollView>
      ) : null}
      <AdminReasonModal
        visible={showSuspend}
        title={user?.is_suspended ? 'Unsuspend user' : 'Suspend user'}
        description={user?.is_suspended
          ? `Unsuspend ${user.full_name}? A reason is required.`
          : `Suspend ${user?.full_name ?? 'this user'}? They will not be able to use their account.`}
        actionLabel={user?.is_suspended ? 'Unsuspend user' : 'Suspend user'}
        loading={saving}
        error={actionError}
        onClose={() => setShowSuspend(false)}
        onConfirm={toggleSuspension}
      />
    </AdminScreen>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon size={17} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SmallAction({ label, onPress, icon: Icon, danger = false, disabled = false }: {
  label: string;
  onPress: () => void;
  icon?: typeof Copy;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallAction, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {Icon ? <Icon size={16} color={danger ? colors.danger : colors.primaryDark} /> : null}
      <Text style={[styles.smallActionText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-SL', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date);
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  suspendedBanner: { padding: Spacing.three, borderRadius: 12, backgroundColor: '#FDE9E9', gap: Spacing.two },
  bannerTitle: { color: colors.danger, ...typography.label },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.heading },
  code: { color: colors.primaryDark, ...typography.caption },
  infoRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  infoLabel: { color: colors.textSecondary, ...typography.caption, width: 82 },
  infoValue: { color: colors.text, ...typography.body, flex: 1, textAlign: 'right' },
  copyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  smallAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two },
  smallActionText: { color: colors.primaryDark, ...typography.label },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  sectionTitle: { color: colors.text, ...typography.heading, marginBottom: Spacing.two },
  membership: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  membershipCopy: { flex: 1 },
  membershipName: { color: colors.text, ...typography.label },
  chevron: { color: colors.textSecondary, fontSize: 24 },
  muted: { color: colors.textSecondary, ...typography.body },
  error: { color: colors.danger, ...typography.caption, marginTop: Spacing.two },
  disabled: { opacity: 0.45 },
  dangerText: { color: colors.danger },
});
