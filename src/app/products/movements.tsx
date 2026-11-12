import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listMovements, type StockMovement } from '@/services/productService';

const movementTypes = ['All', 'opening', 'stock_in', 'stock_out', 'adjustment', 'return'];

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function Movements() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { ctx } = useAuth();
  const [type, setType] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ctx?.businessId) {
      setLoading(false);
      setError('Your business is not available.');
      return;
    }
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Start date must use YYYY-MM-DD.');
      return;
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError('End date must use YYYY-MM-DD.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be before or equal to end date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listMovements(ctx.businessId, {
        type: type === 'All' ? undefined : type,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        productId,
        page,
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ctx?.businessId, endDate, page, productId, startDate, type]);

  useEffect(() => { void load(); }, [load]);
  const pageCount = Math.max(1, Math.ceil(total / 30));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}><ScreenHeader title="Stock movements" subtitle="Latest activity for your business" onBack={() => router.back()} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filters}>
          {movementTypes.map((item) => {
            const selected = type === item;
            return <Pressable key={item} onPress={() => { setType(item); setPage(0); }} style={[styles.chip, selected && styles.selectedChip]} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${item.replace('_', ' ')} movement filter`}><Text style={[styles.chipText, selected && styles.selectedChipText]}>{item.replace('_', ' ')}</Text></Pressable>;
          })}
        </View>
      </ScrollView>
      <View style={styles.dates}>
        <TextInput value={startDate} onChangeText={(value) => { setStartDate(value); setPage(0); }} placeholder="From YYYY-MM-DD" placeholderTextColor={colors.textSecondary} style={styles.dateInput} autoCapitalize="none" accessibilityLabel="Movement start date" />
        <TextInput value={endDate} onChangeText={(value) => { setEndDate(value); setPage(0); }} placeholder="To YYYY-MM-DD" placeholderTextColor={colors.textSecondary} style={styles.dateInput} autoCapitalize="none" accessibilityLabel="Movement end date" />
      </View>

      {error ? (
        <View style={styles.state}><Text style={styles.error}>{error}</Text><View style={{ width: '100%', maxWidth: 300, marginTop: 16 }}><Button label="Try again" onPress={() => void load()} /></View></View>
      ) : loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading movements...</Text></View>
      ) : rows.length === 0 ? (
        <View style={styles.state}><Text style={styles.emptyTitle}>No stock movements found</Text><Text style={styles.subtitle}>Try a different movement type or date range.</Text></View>
      ) : (
        <ScrollView style={styles.movementsList} contentContainerStyle={styles.list}>
          {rows.map((movement) => <MovementCard key={movement.id} item={movement} />)}
        </ScrollView>
      )}
      <View style={styles.pagination}>
        <Pressable disabled={page === 0 || loading} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.pageButton, (page === 0 || loading) && styles.disabled]} accessibilityRole="button" accessibilityLabel="Previous page"><ChevronLeft size={20} color={colors.primaryDark} /></Pressable>
        <Text style={styles.pageText}>Page {page + 1} of {pageCount}</Text>
        <Pressable disabled={page + 1 >= pageCount || loading} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, (page + 1 >= pageCount || loading) && styles.disabled]} accessibilityRole="button" accessibilityLabel="Next page"><ChevronRight size={20} color={colors.primaryDark} /></Pressable>
      </View>
    </SafeAreaView>
  );
}

function MovementCard({ item }: { item: StockMovement }) {
  const inbound = item.quantity_change > 0;
  return (
    <Pressable onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.product_id } })} style={styles.card} accessibilityRole="button" accessibilityLabel={`View stock movement for ${item.product_name}`}>
      <View style={[styles.movementIcon, { backgroundColor: inbound ? colors.primaryLight : '#FFF3E0' }]}>
        {inbound ? <ArrowDownLeft size={20} color={colors.primary} /> : <ArrowUpRight size={20} color={colors.warning} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.meta}>{item.reason || item.type.replace('_', ' ')} · {dateLabel(item.created_at)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.quantity, { color: inbound ? colors.primary : colors.danger }]}>{inbound ? '+' : ''}{item.quantity_change}</Text>
        <Text style={styles.meta}>After: {item.quantity_after}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  filterScroll: { maxHeight: 52, marginTop: 4, flexGrow: 0 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 13, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  selectedChipText: { color: colors.primaryDark },
  dates: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 8 },
  dateInput: { flex: 1, minHeight: 48, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 12 },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 12 },
  movementsList: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: radius.lg, backgroundColor: colors.white },
  movementIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  productName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  quantity: { fontWeight: '800', fontSize: 16 },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  error: { color: colors.danger, textAlign: 'center', lineHeight: 22 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  pageButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pageText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  subtitle: { color: colors.textSecondary, marginTop: 5, textAlign: 'center', fontSize: 13 },
});
