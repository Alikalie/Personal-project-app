import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Building2, Shield, UserRound } from 'lucide-react-native';

import { AdminEmpty, AdminError, AdminLoading, AdminScreen, adminReasonDetails, adminRowDate } from '@/components/admin/AdminUi';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAdminAudit, type AdminAuditEntry } from '@/services/adminService';

const pageSize = 30;

function actionSentence(entry: AdminAuditEntry): string {
  const action = entry.action.toLowerCase().replace(/[_-]+/g, ' ');
  const target = entry.target_type.toLowerCase();
  const targetName = target.includes('business') ? 'business' : target.includes('admin') ? 'admin' : 'user';
  const phrases: [RegExp, string][] = [
    [/suspend/, 'suspended'],
    [/unsuspend|restore|reactivat/, 'unsuspended'],
    [/grant|promot|add admin/, 'granted admin access to'],
    [/revoke|remov/, 'removed admin access from'],
  ];
  const phrase = phrases.find(([pattern]) => pattern.test(action))?.[1] ?? action;
  return `${entry.admin_email || 'An admin'} ${phrase} ${targetName} ${entry.target_id || ''}`.trim();
}

function ActionIcon({ entry }: { entry: AdminAuditEntry }) {
  const target = entry.target_type.toLowerCase();
  if (target.includes('business')) return <Building2 size={19} color={colors.primaryDark} />;
  if (target.includes('admin')) return <Shield size={19} color={colors.primaryDark} />;
  return <UserRound size={19} color={colors.primaryDark} />;
}

export default function AdminAudit() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const requestLock = useRef(false);

  const load = useCallback(async (reset = true, refresh = false) => {
    if (requestLock.current) return;
    requestLock.current = true;
    if (reset) {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError('');
    } else setLoadingMore(true);
    const start = reset ? 0 : offsetRef.current;
    try {
      const rows = await listAdminAudit(pageSize, start);
      setEntries((current) => reset ? rows : [...current, ...rows]);
      offsetRef.current = start + rows.length;
      setHasMore(rows.length === pageSize);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      requestLock.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(true);
  }, [load]));

  const openTarget = (entry: AdminAuditEntry) => {
    const target = entry.target_type.toLowerCase();
    if (!entry.target_id) return;
    if (target.includes('business')) {
      router.push({ pathname: '/admin/business/[id]', params: { id: entry.target_id } });
    } else {
      router.push({ pathname: '/admin/user/[id]', params: { id: entry.target_id } });
    }
  };

  return (
    <AdminScreen title="Audit log" subtitle="Recent platform admin actions">
      {error && entries.length === 0 ? <AdminError message={error} onRetry={() => void load(true, true)} /> : loading && entries.length === 0 ? (
        <AdminLoading rows={5} />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true, true)} tintColor={colors.primary} />}
            onEndReached={() => {
              if (!loadingMore && hasMore && !loading) void load(false);
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={() => <AdminEmpty message="No admin activity yet." />}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : undefined}
            renderItem={({ item }) => {
              const reason = adminReasonDetails(item.details);
              return (
                <Pressable
                  onPress={() => openTarget(item)}
                  disabled={!item.target_id}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={actionSentence(item)}
                >
                  <View style={styles.icon}><ActionIcon entry={item} /></View>
                  <View style={styles.copy}>
                    <Text style={styles.sentence}>{actionSentence(item)}</Text>
                    {reason ? <Text style={styles.reason}>Reason: {reason}</Text> : null}
                    <Text style={styles.date}>{adminRowDate(item.created_at)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  sentence: { color: colors.text, ...typography.label },
  reason: { color: colors.textSecondary, ...typography.caption },
  date: { color: colors.textSecondary, ...typography.caption },
  separator: { height: 1, backgroundColor: colors.border },
  footer: { padding: Spacing.four },
  error: { color: colors.danger, ...typography.caption, paddingVertical: Spacing.two },
});
