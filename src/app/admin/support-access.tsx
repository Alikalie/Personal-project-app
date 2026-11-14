import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminEmpty, AdminError, AdminInitials, AdminLoading, AdminScreen, AdminSearch, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAdminBusinesses, type AdminBusinessRow } from '@/services/adminService';
import { startSupportAccess } from '@/services/supportAccessService';

const pageSize = 30;
const durations = [15, 30, 60, 120] as const;

export default function SupportAccessScreen() {
  const { ctx } = useAuth();
  const { businessId: routeBusinessId } = useLocalSearchParams<{ businessId?: string }>();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [businesses, setBusinesses] = useState<AdminBusinessRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminBusinessRow | null>(null);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState<(typeof durations)[number]>(30);
  const [writeAccess, setWriteAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setBusinesses(await listAdminBusinesses(search, pageSize, 0));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!routeBusinessId || !businesses.length) return;
    const business = businesses.find((item) => item.business_id === routeBusinessId);
    if (business) setSelected(business);
  }, [businesses, routeBusinessId]);

  const begin = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      const session = await startSupportAccess({
        businessId: selected.business_id,
        businessName: selected.name,
        reason,
        minutes,
        write: superAdmin && writeAccess,
      });
      setSelected(null);
      setReason('');
      setWriteAccess(false);
      router.push({ pathname: '/admin/support-access/[id]', params: { id: selected.business_id, sessionId: session.id } });
    } catch (startError) {
      console.warn('Support access could not be opened:', startError);
      setError(friendlyErrorMessage(startError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title="Support access" subtitle="Open a temporary business data session">
      {error && businesses.length === 0 ? <AdminError message={error} onRetry={() => void load(true)} /> : loading && businesses.length === 0 ? <AdminLoading rows={5} /> : (
        <>
          <View style={styles.search}>
            <AdminSearch value={search} onChangeText={setSearch} placeholder="Search business name or code" />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={businesses}
            keyExtractor={(item) => item.business_id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
            ListEmptyComponent={() => <AdminEmpty message="No businesses found." />}
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelected(item)} style={styles.businessRow} accessibilityRole="button">
                <AdminInitials name={item.name} />
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.code}>{item.business_code}</Text>
                  <Text style={styles.meta}>{item.owner_email || 'Owner not available'}</Text>
                  <Text style={styles.meta}>{item.products_count} products · {item.sales_count} sales</Text>
                </View>
                <AdminStatusBadge label={item.is_suspended ? 'Suspended' : 'Active'} tone={item.is_suspended ? 'danger' : 'success'} />
              </Pressable>
            )}
          />
        </>
      )}
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => { if (!saving) setSelected(null); }}>
        <View style={styles.scrim}>
          <AdminCard>
            <Text style={styles.title}>Open support access</Text>
            <Text style={styles.meta}>Access to {selected?.name} will be time-limited and audited.</Text>
            <Text style={styles.label}>Reason (at least 10 characters)</Text>
            <TextInput value={reason} onChangeText={setReason} multiline style={styles.reasonInput} accessibilityLabel="Reason for support access" />
            <Text style={styles.label}>Duration</Text>
            <View style={styles.options}>
              {durations.map((duration) => (
                <Pressable key={duration} onPress={() => setMinutes(duration)} style={[styles.option, minutes === duration && styles.optionSelected]} accessibilityRole="button" accessibilityState={{ selected: minutes === duration }}>
                  <Text style={[styles.optionText, minutes === duration && styles.optionTextSelected]}>{duration} min</Text>
                </Pressable>
              ))}
            </View>
            {superAdmin ? (
              <View style={styles.writeRow}>
                <View style={styles.copy}>
                  <Text style={styles.label}>Allow changes</Text>
                  <Text style={styles.meta}>Only categories, products, customers and expenses.</Text>
                </View>
                <Switch value={writeAccess} onValueChange={setWriteAccess} disabled={saving} trackColor={{ true: colors.primary }} />
              </View>
            ) : <Text style={styles.meta}>Support access is read-only.</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Open support access" onPress={() => void begin()} loading={saving} disabled={saving || reason.trim().length < 10} />
            {reason.trim().length < 10 && !saving ? <Text style={styles.meta}>Enter a reason of at least 10 characters.</Text> : null}
            <Button label="Cancel" variant="outline" onPress={() => setSelected(null)} disabled={saving} />
          </AdminCard>
        </View>
      </Modal>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  search: { paddingBottom: Spacing.two },
  list: { paddingBottom: Spacing.seven },
  businessRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: colors.border },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.label },
  code: { color: colors.primaryDark, ...typography.caption },
  meta: { color: colors.textSecondary, ...typography.caption },
  title: { color: colors.text, ...typography.heading },
  label: { color: colors.text, ...typography.label },
  reasonInput: { minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.three, color: colors.text, textAlignVertical: 'top' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  optionSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, ...typography.caption },
  optionTextSelected: { color: colors.primaryDark },
  writeRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  scrim: { flex: 1, justifyContent: 'center', padding: Spacing.five, backgroundColor: 'rgba(0,0,0,0.42)' },
  error: { color: colors.danger, ...typography.caption },
});
