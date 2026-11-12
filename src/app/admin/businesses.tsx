import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AdminEmpty, AdminError, AdminFilterChips, AdminLoading, AdminScreen, AdminSearch, AdminStatusBadge } from '@/components/admin/AdminUi';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAdminBusinesses, type AdminBusinessRow } from '@/services/adminService';

type BusinessFilter = 'all' | 'active' | 'suspended' | 'no-products' | 'inactive';
const pageSize = 30;
const inactiveAfterMs = 30 * 86400000;

export default function AdminBusinesses() {
  const { filter: routeFilter } = useLocalSearchParams<{ filter?: string }>();
  const [businesses, setBusinesses] = useState<AdminBusinessRow[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<BusinessFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const requestLock = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (routeFilter === 'suspended' || routeFilter === 'no-products' || routeFilter === 'inactive') {
      setFilter(routeFilter);
    }
  }, [routeFilter]);

  const load = useCallback(async (reset = true, refresh = false) => {
    if (requestLock.current) return;
    requestLock.current = true;
    if (reset) {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }
    const start = reset ? 0 : offsetRef.current;
    try {
      const rows = await listAdminBusinesses(debouncedSearch, pageSize, start);
      setBusinesses((current) => reset ? rows : [...current, ...rows]);
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
  }, [debouncedSearch]);

  useFocusEffect(useCallback(() => {
    void load(true);
  }, [debouncedSearch]));

  const cutoff = Date.now() - inactiveAfterMs;
  const visibleBusinesses = businesses.filter((business) => {
    if (filter === 'active') return !business.is_suspended;
    if (filter === 'suspended') return business.is_suspended;
    if (filter === 'no-products') return business.products_count === 0;
    if (filter === 'inactive') return !business.last_sale_at || new Date(business.last_sale_at).getTime() < cutoff;
    return true;
  });

  const renderBusiness = ({ item }: { item: AdminBusinessRow }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/admin/business/[id]', params: { id: item.business_id } })}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.business_code}, view business details`}
    >
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.code}>{item.business_code || 'BIZ code unavailable'}</Text>
        <Text style={styles.detail} numberOfLines={1}>
          {[item.business_type, item.district].filter(Boolean).join(' · ') || 'Type or district unavailable'}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {item.owner_email || item.owner_profile_code
            ? `Owner: ${item.owner_email || item.owner_profile_code}`
            : 'Owner unavailable'}
        </Text>
        <Text style={styles.counts} numberOfLines={1}>
          {item.products_count} products · {item.sales_count} sales
        </Text>
      </View>
      <AdminStatusBadge label={item.is_suspended ? 'Suspended' : 'Active'} tone={item.is_suspended ? 'danger' : 'success'} />
    </Pressable>
  );

  return (
    <AdminScreen title="Businesses" subtitle="Details and activity counts only">
      <View style={styles.controls}>
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Search name, owner or business code" />
        <AdminFilterChips
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'no-products', label: 'No products yet' },
            { value: 'inactive', label: 'Inactive 30 days+' },
          ]}
          selected={filter}
          onSelect={setFilter}
        />
        <Text style={styles.filterNote}>Filters apply to the businesses loaded so far.</Text>
      </View>
      {error && businesses.length === 0 ? <AdminError message={error} onRetry={() => void load(true, true)} /> : loading && businesses.length === 0 ? (
        <AdminLoading />
      ) : (
        <>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          <FlatList
            data={visibleBusinesses}
            keyExtractor={(item) => item.business_id}
            renderItem={renderBusiness}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true, true)} tintColor={colors.primary} />}
            onEndReached={() => {
              if (!loadingMore && hasMore && !loading) void load(false);
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={() => <AdminEmpty message="No businesses match this filter." />}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : undefined}
          />
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: 2 },
  filterNote: { color: colors.textSecondary, ...typography.caption, paddingBottom: Spacing.two },
  inlineError: { color: colors.danger, ...typography.caption, paddingVertical: Spacing.two },
  list: { paddingBottom: Spacing.seven },
  row: { minHeight: 105, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.three },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.text, ...typography.label },
  code: { color: colors.primaryDark, ...typography.caption },
  detail: { color: colors.textSecondary, ...typography.caption },
  counts: { color: colors.text, ...typography.caption },
  separator: { height: 1, backgroundColor: colors.border },
  footer: { padding: Spacing.four },
});
