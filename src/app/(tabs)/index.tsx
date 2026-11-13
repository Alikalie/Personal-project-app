import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  Bell,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { Badge, Card, EmptyState, IconButton, ListRow, SectionHeader, Skeleton } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius, shadow, Spacing } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { getDashboard, subscribeToDashboardRefresh } from '@/services/dashboardService';

type Dash = Awaited<ReturnType<typeof getDashboard>>;

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Freetown',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function transactionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?';
}

export default function Dashboard() {
  const { ctx } = useAuth();
  const role = ctx?.business?.role?.toLowerCase();
  const showProfit = role === 'owner' || role === 'manager';
  const canWrite = showProfit;
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState<number>(6);

  const load = useCallback(async (refresh = false) => {
    if (!ctx?.businessId) {
      setLoading(false);
      setError('Your business details are not available. Please finish setup and try again.');
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await getDashboard(ctx.businessId, showProfit));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ctx?.businessId, showProfit]);

  const refreshAfterSale = useCallback(async (businessId: string) => {
    if (ctx?.businessId !== businessId) return;
    setRefreshing(true);
    setError('');
    try {
      setData(await getDashboard(businessId, showProfit));
    } catch (refreshError) {
      setError(friendlyErrorMessage(refreshError));
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [ctx?.businessId, showProfit]);

  useEffect(() => subscribeToDashboardRefresh(refreshAfterSale), [refreshAfterSale]);
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton width="58%" height={26} />
          <Skeleton width="40%" height={16} style={{ marginTop: 10 }} />
          <Skeleton height={188} radius={24} style={{ marginTop: 22 }} />
          <View style={styles.statGrid}>
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={118} radius={16} width="48%" />)}
          </View>
          <Skeleton height={140} radius={16} style={{ marginTop: 20 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar style="dark" />
        <EmptyState
          icon={Receipt}
          title="Dashboard unavailable"
          message={error || 'Dashboard data is not available.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </SafeAreaView>
    );
  }

  const max = Math.max(0, ...data.weekSales.map((item) => item.value));
  const margin = data.todaySales > 0 ? Math.round((data.grossProfit * 100) / data.todaySales) : 0;
  const noSales = data.weekSales.every((item) => item.value === 0);
  const dayIndex = Math.min(selectedDay, data.weekSales.length - 1);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.greetingGroup}>
            <Text style={styles.hello}>{greeting()}</Text>
            <Text style={styles.businessName} numberOfLines={1}>{ctx?.businessName}</Text>
          </View>
          <IconButton icon={Bell} label="View low-stock alerts" onPress={() => router.push('/products/low-stock')} />
          <View style={styles.avatar} accessible accessibilityLabel={`Signed in as ${ctx?.name || 'user'}`}>
            <Text style={styles.avatarText}>{initials(ctx?.name ?? '')}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Today's sales</Text>
          <Text style={styles.heroValue}>{formatSLE(data.todaySales)}</Text>
          <View style={styles.vsPill}>
            {noSales ? null : <TrendingUp size={14} color={colors.white} />}
            <Text style={styles.vsText}>{noSales ? 'No sales yet today' : 'Today so far'}</Text>
          </View>
          {showProfit && (
            <>
              <View style={styles.heroDivider} />
              <View style={styles.profitRow}>
                <View>
                  <Text style={styles.heroLabel}>Estimated gross profit</Text>
                  <Text style={styles.heroProfit}>{formatSLE(data.grossProfit)}</Text>
                </View>
                <Text style={styles.heroMargin}>{margin}% margin</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon={ShoppingCart} label="New sale" onPress={() => router.push('/(tabs)/sales')} />
          <QuickAction icon={Package} label="Add product" disabled={!canWrite} onPress={() => router.push('/products/new')} />
          {canWrite ? (
            <QuickAction
              icon={Wallet}
              label="Add expense"
              onPress={() => router.push('/expenses')}
            />
          ) : null}
          <QuickAction
            icon={UserPlus}
            label="Add customer"
            onPress={() => router.push({ pathname: '/(tabs)/customers', params: { add: '1' } })}
          />
        </View>

        {data.lowStock > 0 || data.outstandingDebts > 0 ? (
          <Card style={styles.attentionCard}>
            <SectionHeader title="Needs attention" />
            {data.lowStock > 0 ? (
              <ListRow
                icon={AlertTriangle}
                title={`${data.lowStock} ${data.lowStock === 1 ? 'product needs' : 'products need'} restocking`}
                subtitle="Low stock"
                trailingValue="View"
                chevron
                onPress={() => router.push('/products/low-stock')}
              />
            ) : null}
            {data.outstandingDebts > 0 ? (
              <ListRow
                icon={Banknote}
                title="Customers who owe you"
                subtitle="Outstanding balance"
                trailingValue={formatSLE(data.outstandingDebts)}
                chevron
                onPress={() => router.push('/(tabs)/customers')}
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.chartCard}>
          <SectionHeader title="Weekly sales" />
          <View style={styles.selectedDaySummary} accessibilityLiveRegion="polite">
            <Text style={styles.selectedDayName}>{data.weekSales[dayIndex].day}, {data.weekSales[dayIndex].date}</Text>
            <Text style={styles.selectedAmount}>Sales: {formatSLE(data.weekSales[dayIndex].value)}</Text>
            {showProfit ? (
              <View style={styles.selectedProfitRow}>
                <Text style={styles.selectedAmount}>Gross profit: {formatSLE(data.weekSales[dayIndex].profit)}</Text>
                <Text style={styles.selectedMargin}>
                  {data.weekSales[dayIndex].value > 0
                    ? `${Math.round((data.weekSales[dayIndex].profit * 100) / data.weekSales[dayIndex].value)}% margin`
                    : '0% margin'}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.chartWrap}>
            <View style={styles.axisLabels}>
              <Text style={styles.axisLabel}>{formatSLE(max)}</Text>
              <Text style={styles.axisLabel}>{formatSLE(0)}</Text>
            </View>
            <View style={styles.chart}>
              {data.weekSales.map((item, index) => {
                const isToday = index === data.weekSales.length - 1;
                const height = max === 0 ? 3 : Math.max(5, (item.value / max) * 102);
                return (
                  <Pressable
                    key={`${item.day}-${index}`}
                    onPress={() => setSelectedDay(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.day}, ${item.date}, sales ${formatSLE(item.value)}${showProfit ? `, gross profit ${formatSLE(item.profit)}` : ''}`}
                    style={styles.barColumn}
                  >
                    <View style={[styles.barTrack, { height: 108 }]}>
                      <View style={[styles.bar, { height, backgroundColor: isToday ? colors.primary : colors.primaryLight }]} />
                    </View>
                    <Text style={[styles.barLabel, isToday && styles.currentDay]}>{item.day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.dailyRows}>
            {data.weekSales.map((item, index) => (
              <Pressable
                key={`${item.date}-summary`}
                onPress={() => setSelectedDay(index)}
                style={[styles.dailyRow, index === dayIndex && styles.dailyRowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: index === dayIndex }}
              >
                <View style={styles.dailyDate}>
                  <Text style={styles.dailyDay}>{item.day}</Text>
                  <Text style={styles.dailyDateText}>{item.date}</Text>
                </View>
                <View style={styles.dailyValues}>
                  <Text style={styles.dailySales}>{formatSLE(item.value)}</Text>
                  {showProfit ? (
                    <Text style={styles.dailyProfit}>
                      {formatSLE(item.profit)} · {item.value > 0 ? `${Math.round((item.profit * 100) / item.value)}%` : '0%'}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          {noSales && <Text style={styles.emptyMessage}>Sales will appear here after your first sale.</Text>}
        </Card>

        <SectionHeader title="Recent sales" />
        <View style={styles.transactions}>
          {data.recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No sales yet"
              message="Make your first sale and it will appear here."
              actionLabel="New sale"
              onAction={() => router.push('/(tabs)/sales')}
            />
          ) : data.recentTransactions.map((transaction) => (
            <ListRow
              key={transaction.id}
              icon={Receipt}
              title={transaction.customer}
              subtitle={`${transaction.receipt}${transactionTime(transaction.soldAt) ? ` · ${transactionTime(transaction.soldAt)}` : ''}`}
              trailingValue={formatSLE(transaction.total)}
              badge={{ label: transaction.credit > 0 ? 'Credit' : 'Paid', tone: transaction.credit > 0 ? 'warning' : 'success' }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon: Icon, label, onPress, disabled = false }: {
  icon: typeof ShoppingCart;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const isDisabled = disabled || !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}, coming soon` : label}
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.quickAction, isDisabled && styles.disabledAction]}
    >
      <View style={styles.quickIcon}><Icon size={20} color={isDisabled ? colors.textSecondary : colors.primary} /></View>
      <Text style={styles.quickLabel}>{label}</Text>
      {disabled && <Badge label="Soon" tone="neutral" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.four, paddingBottom: Spacing.seven },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.four },
  greetingGroup: { flex: 1, minWidth: 0 },
  hello: { color: colors.textSecondary, fontSize: 13 },
  businessName: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: Spacing.five, ...shadow },
  heroLabel: { color: colors.primaryLight, fontSize: 13, fontWeight: '600' },
  heroValue: { color: colors.white, fontSize: 34, fontWeight: '800', marginTop: 4 },
  vsPill: { minHeight: 30, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)' },
  vsText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: Spacing.four },
  profitRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  heroProfit: { color: colors.white, fontSize: 21, fontWeight: '800', marginTop: 3 },
  heroMargin: { color: colors.primaryLight, fontSize: 13, fontWeight: '600', paddingBottom: 3 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.four, marginBottom: Spacing.four },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginVertical: Spacing.two },
  quickAction: { flex: 1, minWidth: 0, minHeight: 76, alignItems: 'center', justifyContent: 'flex-start', gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  disabledAction: { opacity: 0.72 },
  attentionCard: { padding: Spacing.two, gap: Spacing.two },
  emptyMessage: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  chartCard: { marginTop: Spacing.two, padding: Spacing.three },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 },
  axisLabels: { height: 108, justifyContent: 'space-between' },
  axisLabel: { color: colors.textSecondary, fontSize: 12, maxWidth: 68 },
  chart: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  barColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  barTrack: { justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '55%', minWidth: 5, maxWidth: 20, borderRadius: 7 },
  barLabel: { color: colors.textSecondary, fontSize: 12 },
  currentDay: { color: colors.primaryDark, fontWeight: '800' },
  selectedDaySummary: { marginTop: 6, gap: 3 },
  selectedDayName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  selectedAmount: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  selectedProfitRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  selectedMargin: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  dailyRows: { marginTop: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  dailyRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: colors.border },
  dailyRowSelected: { backgroundColor: colors.primaryLight, marginHorizontal: -Spacing.three, paddingHorizontal: Spacing.three },
  dailyDate: { minWidth: 76 },
  dailyDay: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dailyDateText: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  dailyValues: { alignItems: 'flex-end', flexShrink: 1 },
  dailySales: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dailyProfit: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  transactions: { gap: 8 },
  disabled: { opacity: 0.5 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
