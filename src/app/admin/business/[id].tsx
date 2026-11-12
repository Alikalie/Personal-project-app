import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MapPin, Phone } from 'lucide-react-native';

import { AdminCard, AdminError, AdminLoading, AdminReason, AdminReasonModal, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  getAdminBusinessDetail,
  setAdminBusinessSuspended,
  type AdminBusinessDetail,
} from '@/services/adminService';

export default function AdminBusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [business, setBusiness] = useState<AdminBusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('Business details are not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setBusiness(await getAdminBusinessDetail(id));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const toggleSuspension = async (reason: string) => {
    if (!business || saving) return;
    setSaving(true);
    setActionError('');
    try {
      await setAdminBusinessSuspended(business.business_id, !business.is_suspended, reason);
      setShowSuspend(false);
      await load();
    } catch (failure) {
      setActionError(friendlyErrorMessage(failure, 'admin'));
      throw failure;
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title="Business details">
      {loading && !business ? <AdminLoading rows={5} /> : error && !business ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : business ? (
        <ScrollView contentContainerStyle={styles.content}>
          {business.is_suspended ? (
            <View style={styles.suspendedBanner}>
              <Text style={styles.bannerTitle}>This business is suspended</Text>
              <AdminReason label={business.suspended_reason} />
            </View>
          ) : null}
          <AdminCard>
            <View style={styles.identity}>
              <View style={styles.identityCopy}>
                <Text style={styles.name}>{business.name}</Text>
                <Text style={styles.code}>{business.business_code || 'BIZ code unavailable'}</Text>
              </View>
              <AdminStatusBadge label={business.is_suspended ? 'Suspended' : 'Active'} tone={business.is_suspended ? 'danger' : 'success'} />
            </View>
            <InfoRow label="Type" value={business.business_type || 'Not provided'} />
            <InfoRow label="District" value={business.district || 'Not provided'} icon={MapPin} />
            <InfoRow label="Address" value={business.address || 'Not provided'} />
            <InfoRow label="Phone" value={business.phone || 'Not provided'} icon={Phone} />
            <InfoRow label="Joined" value={dateLabel(business.created_at)} />
            {business.owner ? (
              <Pressable
                onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: business.owner?.user_id ?? '' } })}
                style={styles.owner}
                accessibilityRole="button"
              >
                <View style={styles.ownerCopy}>
                  <Text style={styles.infoLabel}>Owner</Text>
                  <Text style={styles.ownerName}>{business.owner.full_name}</Text>
                  <Text style={styles.infoValue}>{business.owner.email}</Text>
                  <Text style={styles.code}>{business.owner.profile_code}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : <InfoRow label="Owner" value={business.owner_email || 'Not available'} />}
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Activity</Text>
            <View style={styles.metricGrid}>
              <Count label="Staff" value={business.counts.members} />
              <Count label="Products" value={business.counts.products} />
              <Count label="Customers" value={business.counts.customers} />
              <Count label="Sales" value={business.counts.sales} />
              <Count label="Expenses" value={business.counts.expenses} />
              <Count label="Last sale" value={relativeDate(business.last_sale_at)} />
            </View>
            <Text style={styles.privacyNote}>For privacy, admins can only see activity counts.</Text>
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Staff</Text>
            {business.staff.length === 0 ? <Text style={styles.muted}>No staff memberships.</Text> : business.staff.map((staff, index) => (
              <View key={`${staff.profile_code}-${index}`} style={styles.staffRow}>
                <View style={styles.staffCopy}>
                  <Text style={styles.staffName}>{staff.full_name}</Text>
                  <Text style={styles.code}>{staff.profile_code}</Text>
                </View>
                <AdminStatusBadge label={staff.role} tone="neutral" />
              </View>
            ))}
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Business status</Text>
            <Button
              label={business.is_suspended ? 'Unsuspend business' : 'Suspend business'}
              onPress={() => {
                setActionError('');
                setShowSuspend(true);
              }}
              variant={business.is_suspended ? 'outline' : 'primary'}
            />
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          </AdminCard>
        </ScrollView>
      ) : null}
      <AdminReasonModal
        visible={showSuspend}
        title={business?.is_suspended ? 'Unsuspend business' : 'Suspend business'}
        description={business?.is_suspended
          ? `Unsuspend ${business.name}? A reason is required.`
          : `Suspend ${business?.name ?? 'this business'}? A reason is required.`}
        actionLabel={business?.is_suspended ? 'Unsuspend business' : 'Suspend business'}
        loading={saving}
        error={actionError}
        onClose={() => setShowSuspend(false)}
        onConfirm={toggleSuspension}
      />
    </AdminScreen>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      {Icon ? <Icon size={16} color={colors.textSecondary} /> : null}
    </View>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.countTile}>
      <Text style={styles.countValue} numberOfLines={1} adjustsFontSizeToFit>{String(value)}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en-SL', { dateStyle: 'medium' }).format(date);
}

function relativeDate(value: string | null): string {
  if (!value) return 'None';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  suspendedBanner: { padding: Spacing.three, borderRadius: 12, backgroundColor: '#FDE9E9', gap: Spacing.two },
  bannerTitle: { color: colors.danger, ...typography.label },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.heading },
  code: { color: colors.primaryDark, ...typography.caption },
  infoRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  infoLabel: { color: colors.textSecondary, ...typography.caption },
  infoValue: { color: colors.text, ...typography.body, flex: 1, textAlign: 'right' },
  owner: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  ownerCopy: { flex: 1, alignItems: 'flex-start', gap: 2 },
  ownerName: { color: colors.text, ...typography.label },
  chevron: { color: colors.textSecondary, fontSize: 24 },
  sectionTitle: { color: colors.text, ...typography.heading, marginBottom: Spacing.three },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  countTile: { width: '48%', minHeight: 68, padding: Spacing.two, borderRadius: 10, backgroundColor: colors.background },
  countValue: { color: colors.text, ...typography.heading },
  privacyNote: { color: colors.textSecondary, ...typography.caption, marginTop: Spacing.three },
  staffRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  staffCopy: { flex: 1 },
  staffName: { color: colors.text, ...typography.label },
  muted: { color: colors.textSecondary, ...typography.body },
  error: { color: colors.danger, ...typography.caption, marginTop: Spacing.two },
});
