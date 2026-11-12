import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AdminEmpty, AdminError, AdminFilterChips, AdminInitials, AdminLoading, AdminScreen, AdminSearch, AdminStatusBadge } from '@/components/admin/AdminUi';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  listAdminUsers,
  type AdminUserRow,
} from '@/services/adminService';

type UserFilter = 'all' | 'active' | 'suspended' | 'admins';
const pageSize = 30;

export default function AdminUsers() {
  const { filter: routeFilter } = useLocalSearchParams<{ filter?: string }>();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
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
    if (routeFilter === 'suspended') setFilter('suspended');
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
      const rows = await listAdminUsers(debouncedSearch, pageSize, start);
      setUsers((current) => reset ? rows : [...current, ...rows]);
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

  const visibleUsers = users.filter((user) => {
    if (filter === 'active') return !user.is_suspended;
    if (filter === 'suspended') return user.is_suspended;
    if (filter === 'admins') return Boolean(user.platform_level);
    return true;
  });

  const renderUser = ({ item }: { item: AdminUserRow }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: item.user_id } })}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.full_name}, ${item.profile_code}, view user details`}
    >
      <AdminInitials name={item.full_name} />
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
        <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
        <Text style={styles.code}>{item.profile_code || 'USR code unavailable'}</Text>
        <Text style={styles.business} numberOfLines={1}>
          {item.business_name
            ? `${item.business_name}${item.business_code ? ` · ${item.business_code}` : ''}`
            : item.businesses_count > 0 ? `${item.businesses_count} businesses` : 'No business'}
        </Text>
        <View style={styles.badges}>
          {item.platform_level ? <AdminStatusBadge label={item.platform_level === 'super_admin' ? 'Super admin' : 'Support'} tone="warning" /> : null}
          <AdminStatusBadge label={item.is_suspended ? 'Suspended' : 'Active'} tone={item.is_suspended ? 'danger' : 'success'} />
        </View>
      </View>
    </Pressable>
  );

  return (
    <AdminScreen title="Users" subtitle="Account details only">
      <View style={styles.controls}>
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Search name, email, phone or code" />
        <AdminFilterChips
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'admins', label: 'Admins' },
          ]}
          selected={filter}
          onSelect={setFilter}
        />
        <Text style={styles.filterNote}>Filters apply to the users loaded so far.</Text>
      </View>
      {error && users.length === 0 ? <AdminError message={error} onRetry={() => void load(true, true)} /> : loading && users.length === 0 ? (
        <AdminLoading />
      ) : (
        <>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          <FlatList
            data={visibleUsers}
            keyExtractor={(item) => item.user_id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true, true)} tintColor={colors.primary} />}
            onEndReached={() => {
              if (!loadingMore && hasMore && !loading) void load(false);
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={() => <AdminEmpty message="No users match this filter." />}
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
  row: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.text, ...typography.label },
  email: { color: colors.textSecondary, ...typography.caption },
  code: { color: colors.primaryDark, ...typography.caption },
  business: { color: colors.textSecondary, ...typography.caption },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border },
  footer: { padding: Spacing.four },
});
