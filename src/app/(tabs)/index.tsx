import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  Bell,
  Banknote,
  Package,
  PackagePlus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react-native';

import { colors, radius, shadow } from '@/constants/theme';
import { formatSLE } from '@/lib/money';
import { getBusiness, getDashboard } from '@/services/dashboardService';

type Dash = Awaited<ReturnType<typeof getDashboard>>;

const actions = [
  { label: 'New sale', icon: ShoppingCart },
  { label: 'Add product', icon: PackagePlus },
  { label: 'Add expense', icon: Wallet },
  { label: 'Add customer', icon: UserPlus },
];

export default function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [biz, setBiz] = useState('');

  useEffect(() => {
    getDashboard().then(setData);
    getBusiness().then((b) => setBiz(b.name));
  }, []);

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const max = Math.max(...data.weekSales.map((d) => d.value));
  const margin = Math.round((data.grossProfit / data.todaySales) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>Good afternoon</Text>
            <Text style={s.biz} numberOfLines={1}>{biz}</Text>
          </View>
          <Pressable style={s.bell}>
            <Bell size={20} color={colors.text} />
            <View style={s.dot} />
          </Pressable>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>Today's sales</Text>
          <Text style={s.heroValue}>{formatSLE(data.todaySales)}</Text>
          <View style={s.pill}>
            <TrendingUp size={13} color="#fff" />
            <Text style={s.pillText}>{data.salesChangePct}% more than yesterday</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={s.heroLabel}>Estimated gross profit</Text>
              <Text style={s.heroProfit}>{formatSLE(data.grossProfit)}</Text>
            </View>
            <Text style={s.heroLabel}>{margin}% margin</Text>
          </View>
        </View>

        <View style={s.grid}>
          <Stat icon={Package} tint={colors.primary} bg={colors.primaryLight} label="Total products" value={`${data.totalProducts}`} />
          <Stat icon={AlertTriangle} tint={colors.warning} bg="#FCF3E1" label="Low stock" value={`${data.lowStock} items`} />
          <Stat icon={Banknote} tint={colors.danger} bg="#FBEAEA" label="Customers owe you" value={formatSLE(data.outstandingDebts)} wide />
        </View>

        <Text style={s.section}>Quick actions</Text>
        <View style={s.actions}>
          {actions.map(({ label, icon: Icon }) => (
            <Pressable key={label} style={s.action}>
              <View style={s.actionIcon}><Icon size={22} color={colors.primary} /></View>
              <Text style={s.actionText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Sales this week</Text>
          <View style={s.chart}>
            {data.weekSales.map((d, i) => {
              const today = i === data.weekSales.length - 1;
              return (
                <View key={d.day} style={s.barCol}>
                  <View style={[s.bar, { height: Math.max(8, (d.value / max) * 110), backgroundColor: today ? colors.primary : '#B9DEC8' }]} />
                  <Text style={[s.barLabel, today && { color: colors.primaryDark, fontWeight: '700' }]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.rowBetween}>
          <Text style={s.section}>Recent transactions</Text>
          <Text style={s.link}>See all</Text>
        </View>
        <View style={[s.card, s.cardFlush]}>
          {data.recentTransactions.map((t, i) => (
            <View key={t.id} style={[s.tx, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}> 
              <View style={s.txIcon}><Receipt size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.txName} numberOfLines={1}>{t.customer}</Text>
                <Text style={s.txMeta}>{t.items} items, {t.method}, {t.time}</Text>
              </View>
              <Text style={[s.txAmount, t.method === 'Credit' && { color: colors.warning }]}>{formatSLE(t.total)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon: Icon, tint, bg, label, value, wide }: any) {
  return (
    <View style={[s.stat, wide && { width: '100%' }]}> 
      <View style={[s.statIcon, { backgroundColor: bg }]}><Icon size={18} color={tint} /></View>
      <View>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  hello: { fontSize: 13, color: colors.textSecondary },
  biz: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#fff' },
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: 20, ...shadow },
  heroLabel: { fontSize: 13, color: '#A9D6BB' },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginTop: 10 },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginVertical: 16 },
  heroProfit: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  stat: { width: '47.8%', backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 1 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', width: '23%' },
  actionIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, marginTop: 24, ...shadow },
  cardFlush: { marginTop: 0 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, marginTop: 16 },
  barCol: { alignItems: 'center', width: '12%', },
  bar: { width: '100%', maxWidth: 24, borderRadius: 10, minHeight: 8 },
  barLabel: { marginTop: 10, fontSize: 11, color: colors.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 24 },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txName: { fontSize: 15, color: colors.text, fontWeight: '700' },
  txMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
});
