import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';

import { EmptyState, ListRow, ScreenHeader, Skeleton } from '@/components/ds';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { listReceiptSales, type SaleHistoryItem } from '@/services/salesService';
import { useAuth } from '@/components/AuthProvider';

const pageSize = 30;

function saleDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SalesHistory() {
  const { ctx } = useAuth();
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const [rows, setRows] = useState<SaleHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const pageRef = useRef(0);
  const hasRowsRef = useRef(false);

  const load = useCallback(async (reset = true) => {
    if (!businessId) {
      setLoading(false);
      setError('Business details are not available.');
      return;
    }
    if (reset) {
      setRefreshing(hasRowsRef.current);
      setLoading(!hasRowsRef.current);
    } else {
      setLoadingMore(true);
    }
    setError('');
    const requestedPage = reset ? 0 : pageRef.current + 1;
    try {
      const result = await listReceiptSales(businessId, { page: requestedPage });
      setRows((current) => {
        const nextRows = reset ? result.rows : [...current, ...result.rows];
        hasRowsRef.current = nextRows.length > 0;
        return nextRows;
      });
      setTotal(result.total);
      pageRef.current = requestedPage;
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [businessId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const hasMore = rows.length < total;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Sales history" onBack={() => router.back()} />
        {loading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={72} radius={14} />)}
          </View>
        ) : error && rows.length === 0 ? (
          <EmptyState icon={FileText} title="Sales unavailable" message={error} actionLabel="Try again" onAction={() => void load()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} title="No sales yet" message="Completed sales will appear here." />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.primary} />}
            onEndReached={() => {
              if (!loadingMore && hasMore) void load(false);
            }}
            onEndReachedThreshold={0.45}
            renderItem={({ item }) => {
              const methods = item.paymentMethods.map((method) => {
                if (method === 'orange_money') return 'Orange Money';
                if (method === 'afrimoney') return 'Afrimoney';
                return method.charAt(0).toUpperCase() + method.slice(1);
              });
              return (
                <ListRow
                  icon={FileText}
                  title={`Receipt ${item.receiptNo}`}
                  subtitle={`${item.customerName} · ${saleDate(item.soldAt)}${methods.length ? ` · ${methods.join(', ')}` : ' · Credit sale'}`}
                  trailingValue={formatSLE(item.totalMinor)}
                  badge={item.creditMinor > 0 ? { label: 'Credit', tone: 'warning' } : undefined}
                  chevron
                  onPress={() => router.push({ pathname: '/sales/receipt/[id]', params: { id: item.id } })}
                />
              );
            }}
            ListFooterComponent={(
              <View style={styles.footer}>
                {loadingMore ? <Text style={styles.footerText}>Loading more…</Text> : null}
                {error ? (
                  <Pressable onPress={() => void load(false)} style={styles.retry} accessibilityRole="button">
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 20 },
  skeletons: { gap: Spacing.two, paddingTop: Spacing.four },
  list: { gap: Spacing.two, paddingVertical: Spacing.three, paddingBottom: 24 },
  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  footerText: { color: colors.textSecondary, ...typography.caption },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  retryText: { color: colors.primary, ...typography.label },
});
