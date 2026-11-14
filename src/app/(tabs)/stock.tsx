import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AlertTriangle, ArrowDownUp, Boxes, Package, Search, Settings2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { Chip, EmptyState, FAB, ListRow, ScreenHeader, Skeleton } from '@/components/ds';
import { colors, radius, Spacing } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { listCategories, type Category } from '@/services/categoryService';
import {
  getLowStockCount,
  getProductCount,
  getStockValuation,
  listProducts,
  type Product,
} from '@/services/productService';

type StockSummary = { total: number; lowStock: number; value: number };
type Filter = { categoryId: string | null; lowStock: boolean };

export default function Stock() {
  const { ctx } = useAuth();
  const businessId = ctx?.businessId;
  const role = ctx?.business?.role?.toLowerCase();
  const canWrite = role === 'owner' || role === 'manager';
  const showValuation = role !== 'cashier';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<StockSummary>({ total: 0, lowStock: 0, value: 0 });
  const [filter, setFilter] = useState<Filter>({ categoryId: null, lowStock: false });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refreshSummary = useCallback(async () => {
    if (!businessId) throw new Error('Your business is not available.');
    const [total, lowStockCount, value, categoryList] = await Promise.all([
      getProductCount(businessId),
      getLowStockCount(businessId),
      showValuation ? getStockValuation(businessId) : Promise.resolve(0),
      listCategories(businessId),
    ]);
    setSummary({ total, lowStock: lowStockCount, value });
    setCategories(categoryList);
  }, [businessId, showValuation]);

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (!businessId) {
      setLoading(false);
      setError('Your business is not available. Please sign in again.');
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [filteredProducts] = await Promise.all([
        listProducts(businessId, {
          search: debouncedSearch,
          categoryId: filter.categoryId ?? undefined,
          lowStock: filter.lowStock,
        }),
        refreshSummary(),
      ]);
      setProducts(filteredProducts);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, debouncedSearch, filter.categoryId, filter.lowStock, refreshSummary]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(useCallback(() => {
    void loadProducts();
  }, [loadProducts]));

  const selectCategory = (categoryId: string | null, lowStock = false) => setFilter({ categoryId, lowStock });
  const filterLabel = useMemo(() => filter.lowStock ? 'Low stock' : filter.categoryId
    ? categories.find((item) => item.id === filter.categoryId)?.name ?? 'Category'
    : 'All', [categories, filter]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <ScreenHeader
          title="Stock"
          subtitle="Products and inventory"
        />
      </View>

      <View style={styles.headerActions}>
        <Pressable onPress={() => router.push('/products/categories')} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Manage categories">
          <Settings2 size={18} color={colors.primaryDark} />
          <Text style={styles.headerActionText}>Categories</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/products/movements')} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Stock movement history">
          <ArrowDownUp size={18} color={colors.primaryDark} />
          <Text style={styles.headerActionText}>Stock history</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <StockMetric icon={Package} label="Products" value={String(summary.total)} />
        </View>
        <View style={styles.summaryCard}>
          <StockMetric
            icon={AlertTriangle}
            label="Low stock"
            value={String(summary.lowStock)}
            tone="warning"
            onPress={() => router.push('/products/low-stock')}
          />
        </View>
        {showValuation && (
          <View style={styles.summaryCard}>
            <StockMetric icon={Boxes} label="Stock value" value={formatSLE(summary.value)} />
          </View>
        )}
      </View>

      <View style={styles.search}>
        <Search size={19} color={colors.textSecondary} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products by name or code" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search products by name or code" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={!filter.categoryId && !filter.lowStock} onPress={() => selectCategory(null)} />
        <Chip label="Low stock" icon={AlertTriangle} selected={filter.lowStock} onPress={() => selectCategory(null, true)} />
        {categories.map((category) => (
          <Chip key={category.id} label={category.name} selected={filter.categoryId === category.id} onPress={() => selectCategory(category.id)} />
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.state}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void loadProducts(true)} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading stock">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.list}>{[0, 1, 2, 3].map((item) => <Skeleton key={item} height={72} radius={16} />)}</View>
      ) : products.length === 0 ? (
        <ScrollView
          style={styles.productList}
          contentContainerStyle={styles.emptyRefresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadProducts(true)} tintColor={colors.primary} />}
        >
          <EmptyState
            icon={Boxes}
            title={summary.total === 0 ? 'No products yet. Add your first product' : 'No products found'}
            message={summary.total === 0 ? 'Products you add will appear here.' : `No results for “${search || filterLabel}”. Try another search or filter.`}
          />
        </ScrollView>
      ) : (
        <FlatList
          style={styles.productList}
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadProducts(true)} tintColor={colors.primary} />}
          renderItem={({ item }) => <ProductRow item={item} onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} />}
        />
      )}

      <FAB label="Add product" allowed={canWrite} onPress={() => router.push('/products/new')} />
    </SafeAreaView>
  );
}

function ProductRow({ item, onPress }: { item: Product; onPress: () => void }) {
  const zero = item.quantity === 0;
  const low = !zero && item.quantity <= item.low_stock_threshold;
  return (
    <ListRow
      image={item.image_url}
      imagePlaceholder={require('@/assets/images/mishop-icon.png')}
      title={item.name}
      subtitle={`${item.category_name ?? 'Uncategorised'} · ${zero ? 'Out of stock' : low ? 'Low stock' : 'In stock'}`}
      badge={{
        label: String(item.quantity),
        tone: zero ? 'danger' : low ? 'warning' : 'success',
      }}
      chevron
      onPress={onPress}
      accessibilityLabel={`View ${item.name}, ${formatSLE(item.selling_price_minor)}, quantity ${item.quantity}, ${zero ? 'out of stock' : low ? 'low stock' : 'in stock'}`}
    />
  );
}

function StockMetric({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  onPress,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  tone?: 'primary' | 'warning';
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={[styles.metricIcon, tone === 'warning' && styles.metricIconWarning]}>
        <Icon size={20} color={tone === 'warning' ? '#815000' : colors.primaryDark} />
      </View>
      <View style={styles.metricText}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.metricCard}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={styles.metricCard}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. View low-stock products`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: Spacing.five, paddingTop: Spacing.one },
  headerActions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.five, paddingBottom: Spacing.two },
  headerAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  headerActionText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  search: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.white, marginHorizontal: Spacing.five, marginTop: 4, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15 },
  chipScroll: { flexGrow: 0, marginTop: 8, maxHeight: 52 },
  chips: { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.five },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Spacing.five, paddingTop: 4, paddingBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: '46%', minWidth: 128 },
  metricCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.white },
  metricIcon: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
  metricIconWarning: { backgroundColor: '#FFF3DC' },
  metricText: { flex: 1, minWidth: 0 },
  metricLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  list: { paddingHorizontal: Spacing.five, paddingTop: 8, paddingBottom: 90, gap: 8 },
  productList: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  emptyRefresh: { flexGrow: 1 },
  error: { color: colors.danger, textAlign: 'center', lineHeight: 22 },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: colors.primaryDark, fontWeight: '800' },
});
