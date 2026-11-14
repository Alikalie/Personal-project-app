import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Activity,
  Building2,
  CircleHelp,
  ClipboardList,
  FileText,
  Headset,
  Mail,
  Megaphone,
  Settings,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminMetric, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  getAdminOverview,
  getSignupTrend,
  type AdminOverview,
  type SignupTrend,
} from '@/services/adminService';

type TrendDays = 7 | 30;

export default function AdminHome() {
  const { ctx } = useAuth();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trend, setTrend] = useState<SignupTrend[]>([]);
  const [days, setDays] = useState<TrendDays>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [overviewData, trendData] = await Promise.all([
        getAdminOverview(refresh),
        getSignupTrend(days),
      ]);
      setOverview(overviewData);
      setTrend(trendData);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    let active = true;
    if (!overview) return () => {
      active = false;
    };
    void getSignupTrend(days).then((rows) => {
      if (active) setTrend(rows);
    }).catch((loadError: unknown) => {
      if (active) setError(friendlyErrorMessage(loadError, 'admin'));
    });
    return () => {
      active = false;
    };
  }, [days]);

  const maxCount = useMemo(() => Math.max(
    1,
    ...trend.flatMap((item) => [item.new_users, item.new_businesses]),
  ), [trend]);
  const suspendedCount = overview
    ? overview.suspended_users + overview.suspended_businesses
    : 0;

  return (
    <AdminScreen title="Admin panel" subtitle={ctx?.name || 'Platform administration'}>
      {loading && !overview ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((item) => <View key={item} style={styles.skeleton} />)}
          </View>
          <View style={styles.skeletonWide} />
          <View style={styles.skeletonWide} />
        </ScrollView>
      ) : error && !overview ? (
        <AdminError message={error} onRetry={() => void load(true)} />
      ) : overview ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        >
          <View style={styles.roleRow}>
            <AdminStatusBadge label={superAdmin ? 'Super admin' : 'Support'} tone="neutral" />
          </View>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          <View style={styles.grid}>
            <AdminMetric label="Total users" value={overview.total_users} icon={Users} />
            <AdminMetric label="New users (7 days)" value={overview.new_users_7d} icon={Users} />
            <AdminMetric label="Businesses" value={overview.total_businesses} icon={Building2} />
            <AdminMetric label="Active businesses (7 days)" value={overview.active_businesses_7d} icon={Activity} />
            <AdminMetric label="Sales today" value={overview.sales_today} icon={Activity} />
            <AdminMetric label="Suspended accounts" value={suspendedCount} icon={Shield} tone="danger" />
          </View>

          <AdminCard>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Growth</Text>
              <View style={styles.toggle}>
                {[7, 30].map((range) => (
                  <Pressable
                    key={range}
                    onPress={() => setDays(range as TrendDays)}
                    style={[styles.toggleButton, days === range && styles.toggleSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: days === range }}
                  >
                    <Text style={[styles.toggleText, days === range && styles.toggleTextSelected]}>{range} days</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={styles.userLegend} /><Text style={styles.legendText}>Users</Text></View>
              <View style={styles.legendItem}><View style={styles.businessLegend} /><Text style={styles.legendText}>Businesses</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chart}>
                {trend.map((item) => (
                  <View key={item.stat_date} style={styles.chartDay}>
                    <View style={styles.bars}>
                      <View style={[styles.bar, styles.userBar, { height: Math.max(3, Math.round((item.new_users * 80) / maxCount)) }]} />
                      <View style={[styles.bar, styles.businessBar, { height: Math.max(3, Math.round((item.new_businesses * 80) / maxCount)) }]} />
                    </View>
                    <Text style={styles.chartDate}>{item.stat_date.slice(5)}</Text>
                  </View>
                ))}
                {trend.length === 0 ? <Text style={styles.muted}>No signup data for this period.</Text> : null}
              </View>
            </ScrollView>
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            <AttentionRow
              label="Businesses with no products"
              count={overview.businesses_no_products}
              onPress={() => router.push({ pathname: '/admin/businesses', params: { filter: 'no-products' } })}
            />
            <AttentionRow
              label="Suspended users"
              count={overview.suspended_users}
              onPress={() => router.push({ pathname: '/admin/users', params: { filter: 'suspended' } })}
            />
            <AttentionRow
              label="Suspended businesses"
              count={overview.suspended_businesses}
              onPress={() => router.push({ pathname: '/admin/businesses', params: { filter: 'suspended' } })}
            />
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Platform tools</Text>
            <NavTile icon={Users} title="Users" subtitle="Account details and status" onPress={() => router.push('/admin/users')} />
            <NavTile icon={Building2} title="Businesses" subtitle="Business details and activity counts" onPress={() => router.push('/admin/businesses')} />
            <NavTile icon={ClipboardList} title="Audit log" subtitle="Recent admin actions" onPress={() => router.push('/admin/audit')} />
            {superAdmin ? <NavTile icon={Shield} title="Admin team" subtitle="Manage platform admins" onPress={() => router.push('/admin/team')} /> : null}
            {superAdmin ? <NavTile icon={Mail} title="Marketing email export" subtitle="Export opted-in email addresses" onPress={() => router.push('/admin/email-export')} /> : null}
            <NavTile icon={FileText} title="Legal documents" subtitle={superAdmin ? 'Draft and publish policies' : 'View published policies'} onPress={() => router.push('/admin/legal')} />
            {superAdmin ? <NavTile icon={Smartphone} title="App versions" subtitle="Manage release updates" onPress={() => router.push('/admin/releases')} /> : null}
            <NavTile icon={Megaphone} title="Announcements" subtitle="Publish updates for shops" onPress={() => router.push('/admin/announcements')} />
            <NavTile icon={CircleHelp} title="FAQ" subtitle="Manage help answers" onPress={() => router.push('/admin/faq')} />
            <NavTile icon={Settings} title="App settings" subtitle={superAdmin ? 'Update public app settings' : 'View app settings'} onPress={() => router.push('/admin/settings')} />
            <NavTile icon={Headset} title="Support access" subtitle="Review active support session" onPress={() => router.push('/admin/support-access')} />
          </AdminCard>
        </ScrollView>
      ) : null}
    </AdminScreen>
  );
}

function AttentionRow({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.attentionRow} accessibilityRole="button">
      <Text style={styles.attentionLabel}>{label}</Text>
      <Text style={[styles.attentionCount, count > 0 && styles.attentionAlert]}>{count}</Text>
    </Pressable>
  );
}

function NavTile({ icon: Icon, title, subtitle, onPress }: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.navTile} accessibilityRole="button">
      <View style={styles.navIcon}><Icon size={20} color={colors.primaryDark} /></View>
      <View style={styles.navCopy}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  roleRow: { alignItems: 'flex-start' },
  inlineError: { color: colors.danger, ...typography.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  skeleton: { width: '48%', height: 100, backgroundColor: colors.border, borderRadius: radius.md },
  skeletonWide: { height: 150, backgroundColor: colors.border, borderRadius: radius.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  sectionTitle: { color: colors.text, ...typography.heading, marginBottom: Spacing.two },
  toggle: { flexDirection: 'row', borderRadius: radius.xl, backgroundColor: colors.background, padding: 3 },
  toggleButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl },
  toggleSelected: { backgroundColor: colors.primaryLight },
  toggleText: { color: colors.textSecondary, ...typography.caption },
  toggleTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
  legendItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  userLegend: { width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary },
  businessLegend: { width: 10, height: 10, borderRadius: 3, backgroundColor: colors.warning },
  legendText: { color: colors.textSecondary, ...typography.caption },
  chart: { minHeight: 125, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: Spacing.three },
  chartDay: { width: 28, alignItems: 'center', gap: 6 },
  bars: { height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 9, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  userBar: { backgroundColor: colors.primary },
  businessBar: { backgroundColor: colors.warning },
  chartDate: { color: colors.textSecondary, fontSize: 10 },
  muted: { color: colors.textSecondary, ...typography.caption },
  attentionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, gap: Spacing.three },
  attentionLabel: { color: colors.text, ...typography.body, flex: 1 },
  attentionCount: { color: colors.textSecondary, ...typography.label },
  attentionAlert: { color: colors.danger },
  navTile: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  navIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
  navCopy: { flex: 1, minWidth: 0 },
  navTitle: { color: colors.text, ...typography.label },
  navSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  chevron: { color: colors.textSecondary, fontSize: 26 },
});
