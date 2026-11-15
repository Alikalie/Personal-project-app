import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CircleHelp,
  ClipboardList,
  Database,
  FileText,
  Headphones,
  Mail,
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Users,
} from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminMetric, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAppSettings, saveAppSetting } from '@/services/contentService';
import { listLegalDocumentVersions } from '@/services/legalAdminService';
import {
  getAdminOverview,
  getSignupTrend,
  type AdminOverview,
  type SignupTrend,
} from '@/services/adminService';

type TrendDays = 7 | 30;

const primaryTools = [
  { title: 'Users', subtitle: 'Accounts and access', icon: Users, route: '/admin/users' },
  { title: 'Shops', subtitle: 'Businesses and activity', icon: Building2, route: '/admin/businesses' },
  { title: 'Data', subtitle: 'Support access and records', icon: Database, route: '/admin/support-access' },
  { title: 'Legal', subtitle: 'Policies and terms', icon: FileText, route: '/admin/legal' },
  { title: 'Versions', subtitle: 'App releases', icon: Smartphone, route: '/admin/releases', superAdminOnly: true },
  { title: 'Notices', subtitle: 'Shop announcements', icon: Bell, route: '/admin/announcements' },
  { title: 'Audit', subtitle: 'Admin activity', icon: ClipboardList, route: '/admin/audit' },
  { title: 'Security', subtitle: 'Sign-in and permissions', icon: Shield, route: '/admin/security' },
] as const;

export default function AdminHome() {
  const { ctx } = useAuth();
  const { settings: publicSettings, refresh: refreshPublicSettings } = usePublicAppSettings();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trend, setTrend] = useState<SignupTrend[]>([]);
  const [draftLegalCount, setDraftLegalCount] = useState(0);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [supportEmail, setSupportEmail] = useState(publicSettings.supportEmail);
  const [supportPhone, setSupportPhone] = useState(publicSettings.supportPhone);
  const [supportWhatsapp, setSupportWhatsapp] = useState(publicSettings.supportWhatsapp);
  const [savingContacts, setSavingContacts] = useState(false);
  const [contactError, setContactError] = useState('');
  const [days, setDays] = useState<TrendDays>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [overviewData, trendData, legalDocuments] = await Promise.all([
        getAdminOverview(refresh),
        getSignupTrend(days),
        listLegalDocumentVersions(),
      ]);
      setOverview(overviewData);
      setTrend(trendData);
      setDraftLegalCount(legalDocuments.filter((document) => document.status === 'draft').length);
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

  const maxCount = useMemo(() => Math.max(
    1,
    ...trend.flatMap((item) => [item.new_users, item.new_businesses]),
  ), [trend]);
  const suspendedCount = overview
    ? overview.suspended_users + overview.suspended_businesses
    : 0;
  const today = new Date().toISOString().slice(0, 10);

  const editSupportContacts = () => {
    setSupportEmail(publicSettings.supportEmail);
    setSupportPhone(publicSettings.supportPhone);
    setSupportWhatsapp(publicSettings.supportWhatsapp);
    setContactError('');
    setContactsVisible(true);
  };

  const saveSupportContacts = async () => {
    if (!superAdmin || savingContacts) return;
    const email = supportEmail.trim();
    const phone = supportPhone.trim();
    const whatsapp = supportWhatsapp.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setContactError('Enter a valid support email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7 || whatsapp.replace(/\D/g, '').length < 7) {
      setContactError('Enter valid support phone and WhatsApp numbers, including the country code.');
      return;
    }
    setSavingContacts(true);
    setContactError('');
    try {
      const currentSettings = await listAppSettings();
      const metadata = new Map(currentSettings.map((setting) => [setting.key, setting]));
      const contactValues = [
        ['support_email', email],
        ['support_phone', phone],
        ['support_whatsapp', whatsapp],
      ] as const;
      await Promise.all(contactValues.map(([key, value]) => {
        const existing = metadata.get(key);
        return saveAppSetting({
          key,
          value,
          description: existing?.description ?? 'Public MiShop support contact',
          is_public: true,
        });
      }));
      await refreshPublicSettings();
      setContactsVisible(false);
    } catch (saveError) {
      setContactError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSavingContacts(false);
    }
  };

  return (
    <AdminScreen title="Admin panel" subtitle="Platform overview">
      {loading && !overview ? (
        <AdminLoading rows={6} />
      ) : error && !overview ? (
        <AdminError message={error} onRetry={() => void load(true)} />
      ) : overview ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        >
          <View style={styles.profile}>
            <View style={styles.profileInitials}>
              <Text style={styles.profileInitialsText}>{initials(ctx?.name ?? '')}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.adminName} numberOfLines={1}>{ctx?.name || 'Admin'}</Text>
              <Text style={styles.profileCode}>{ctx?.profileCode || 'USR code unavailable'}</Text>
            </View>
            <AdminStatusBadge label={superAdmin ? 'Super admin' : 'Support'} tone={superAdmin ? 'success' : 'neutral'} />
          </View>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          <View style={styles.grid}>
            <AdminMetric label="Users" value={overview.total_users} icon={Users} />
            <AdminMetric label="New · 7 days" value={overview.new_users_7d} icon={Activity} />
            <AdminMetric label="Shops" value={overview.total_businesses} icon={Building2} />
            <AdminMetric label="Active · 7 days" value={overview.active_businesses_7d} icon={Activity} />
            <AdminMetric label="Sales today" value={overview.sales_today} icon={ArrowUpRight} />
            <AdminMetric label="Suspended" value={suspendedCount} icon={ShieldAlert} tone="danger" />
          </View>

          <AdminCard>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionTitle}>Growth</Text>
                <Text style={styles.cardSubtitle}>New users and shops</Text>
              </View>
              <View style={styles.toggle}>
                {([7, 30] as const).map((range) => (
                  <Pressable
                    key={range}
                    onPress={() => setDays(range)}
                    style={[styles.toggleButton, days === range && styles.toggleSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${range} days of growth`}
                    accessibilityState={{ selected: days === range }}
                  >
                    <Text style={[styles.toggleText, days === range && styles.toggleTextSelected]}>{range} days</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.legend}>
              <Legend color={colors.primary} label="Users" />
              <Legend color={colors.warning} label="Shops" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
              <View style={styles.chart}>
                {trend.map((item) => {
                  const isToday = item.stat_date === today;
                  return (
                    <View key={item.stat_date} style={[styles.chartDay, isToday && styles.chartDayToday]}>
                      <View style={styles.bars}>
                        <View style={[styles.bar, styles.userBar, { height: Math.max(3, Math.round((item.new_users * 72) / maxCount)) }]} />
                        <View style={[styles.bar, styles.shopBar, { height: Math.max(3, Math.round((item.new_businesses * 72) / maxCount)) }]} />
                      </View>
                      <Text style={[styles.chartDate, isToday && styles.chartDateToday]}>{isToday ? 'Today' : item.stat_date.slice(5)}</Text>
                    </View>
                  );
                })}
                {trend.length === 0 ? <Text style={styles.muted}>No signup data for this period.</Text> : null}
              </View>
            </ScrollView>
          </AdminCard>

          <AdminCard>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            <AttentionRow
              label="Shops with no products"
              count={overview.businesses_no_products}
              onPress={() => router.push({ pathname: '/admin/businesses', params: { filter: 'no-products' } })}
            />
            <AttentionRow
              label="Suspended accounts"
              count={suspendedCount}
              onPress={() => router.push({ pathname: '/admin/users', params: { filter: 'suspended' } })}
            />
            <AttentionRow
              label="Draft legal documents"
              count={draftLegalCount}
              onPress={() => router.push('/admin/legal')}
            />
          </AdminCard>

          <AdminCard>
            <View style={styles.cardHeader}>
              <View style={styles.contactCopy}>
                <Text style={styles.sectionTitle}>Public support contacts</Text>
                <Text style={styles.cardSubtitle}>Shown to customers on Help and support</Text>
              </View>
              {superAdmin ? (
                <Pressable
                  onPress={editSupportContacts}
                  style={styles.editContacts}
                  accessibilityRole="button"
                  accessibilityLabel="Edit public support contact details"
                >
                  <Text style={styles.editContactsText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <ContactLine label="Email" value={publicSettings.supportEmail} />
            <ContactLine label="Phone" value={publicSettings.supportPhone} />
            <ContactLine label="WhatsApp" value={publicSettings.supportWhatsapp} />
          </AdminCard>

          <View style={styles.toolsHeading}>
            <Text style={styles.sectionTitle}>Admin tools</Text>
            <Text style={styles.cardSubtitle}>Manage MiShop from one place</Text>
          </View>
          <View style={styles.toolGrid}>
            {primaryTools
              .filter((tool) => !('superAdminOnly' in tool) || superAdmin)
              .map((tool) => (
                <ToolTile
                  key={tool.title}
                  icon={tool.icon}
                  title={tool.title}
                  subtitle={tool.subtitle}
                  onPress={() => router.push(tool.route)}
                />
              ))}
          </View>

          <View style={styles.toolsHeading}>
            <Text style={styles.sectionTitle}>More tools</Text>
          </View>
          <View style={styles.moreTools}>
            {superAdmin ? <MoreTool icon={Mail} title="Email list" onPress={() => router.push('/admin/email-export')} /> : null}
            <MoreTool icon={CircleHelp} title="FAQ" onPress={() => router.push('/admin/faq')} />
            <MoreTool icon={Settings} title="Settings" onPress={() => router.push('/admin/settings')} />
            {superAdmin ? <MoreTool icon={Shield} title="Admin team" onPress={() => router.push('/admin/team')} /> : null}
            <MoreTool icon={Headphones} title="Support access" onPress={() => router.push('/admin/support-access')} />
          </View>
        </ScrollView>
      ) : null}
      <Modal
        visible={contactsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingContacts) setContactsVisible(false);
        }}
      >
        <View style={styles.modalScrim}>
          <View style={styles.contactModal}>
            <Text style={styles.sectionTitle}>Edit support contacts</Text>
            <Text style={styles.cardSubtitle}>These details are public on the Help and support screen.</Text>
            <Field label="Support email" value={supportEmail} onChangeText={setSupportEmail} keyboardType="email-address" autoCapitalize="none" editable={!savingContacts} />
            <Field label="Support phone" value={supportPhone} onChangeText={setSupportPhone} keyboardType="phone-pad" editable={!savingContacts} />
            <Field label="WhatsApp number" value={supportWhatsapp} onChangeText={setSupportWhatsapp} keyboardType="phone-pad" editable={!savingContacts} />
            {contactError ? <Text style={styles.contactError}>{contactError}</Text> : null}
            <Button label="Save public contacts" onPress={() => void saveSupportContacts()} loading={savingContacts} disabled={savingContacts} />
            <Button label="Cancel" variant="outline" onPress={() => setContactsVisible(false)} disabled={savingContacts} />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || 'A';
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function AttentionRow({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.attentionRow}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count}. View details`}
    >
      <View style={styles.attentionCopy}>
        <Text style={styles.attentionLabel}>{label}</Text>
        <Text style={styles.attentionHint}>{count > 0 ? 'Review items that need action' : 'All clear'}</Text>
      </View>
      <View style={[styles.attentionCountWrap, count > 0 && styles.attentionCountWrapAlert]}>
        <Text style={[styles.attentionCount, count > 0 && styles.attentionAlert]}>{count}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ToolTile({ icon: Icon, title, subtitle, onPress }: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.toolTile, pressed && styles.toolTilePressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.toolIcon}><Icon size={20} color={colors.primaryDark} /></View>
      <Text style={styles.toolTitle}>{title}</Text>
      <Text style={styles.toolSubtitle} numberOfLines={2}>{subtitle}</Text>
    </Pressable>
  );
}

function MoreTool({ icon: Icon, title, onPress }: {
  icon: typeof Users;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.moreTool, pressed && styles.toolTilePressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Icon size={18} color={colors.primaryDark} />
      <Text style={styles.moreToolTitle}>{title}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contactLine}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  profile: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  profileInitials: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  profileInitialsText: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  profileCopy: { flex: 1, minWidth: 0 },
  greeting: { color: colors.textSecondary, ...typography.caption },
  adminName: { color: colors.text, ...typography.heading },
  profileCode: { color: colors.primaryDark, ...typography.caption, marginTop: 2 },
  inlineError: { color: colors.danger, ...typography.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  sectionTitle: { color: colors.text, ...typography.heading },
  cardSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 2 },
  toggle: { flexDirection: 'row', borderRadius: radius.xl, backgroundColor: colors.background, padding: 3 },
  toggleButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl },
  toggleSelected: { backgroundColor: colors.primaryLight },
  toggleText: { color: colors.textSecondary, ...typography.caption },
  toggleTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.three },
  legendItem: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.textSecondary, ...typography.caption },
  chartScroll: { minWidth: '100%' },
  chart: { minHeight: 132, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: Spacing.three },
  chartDay: { width: 32, minHeight: 114, alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingVertical: Spacing.one, borderRadius: radius.sm },
  chartDayToday: { backgroundColor: colors.primaryLight },
  bars: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  userBar: { backgroundColor: colors.primary },
  shopBar: { backgroundColor: colors.warning },
  chartDate: { color: colors.textSecondary, fontSize: 10 },
  chartDateToday: { color: colors.primaryDark, fontWeight: '700' },
  muted: { color: colors.textSecondary, ...typography.caption },
  attentionRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  attentionCopy: { flex: 1 },
  attentionLabel: { color: colors.text, ...typography.label },
  attentionHint: { color: colors.textSecondary, ...typography.caption, marginTop: 2 },
  attentionCountWrap: { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.background },
  attentionCountWrapAlert: { backgroundColor: '#FDE9E9' },
  attentionCount: { color: colors.textSecondary, ...typography.label },
  attentionAlert: { color: colors.danger },
  chevron: { color: colors.textSecondary, fontSize: 25 },
  toolsHeading: { marginTop: Spacing.two },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  toolTile: { width: '48%', minHeight: 124, padding: Spacing.three, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white },
  toolTilePressed: { opacity: 0.8 },
  toolIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
  toolTitle: { color: colors.text, ...typography.label, marginTop: Spacing.two },
  toolSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  moreTools: { paddingHorizontal: Spacing.three, borderRadius: radius.lg, backgroundColor: colors.white },
  moreTool: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: colors.border },
  moreToolTitle: { color: colors.text, ...typography.label, flex: 1 },
  contactCopy: { flex: 1, minWidth: 0 },
  editContacts: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  editContactsText: { color: colors.primaryDark, ...typography.label },
  contactLine: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  contactLabel: { color: colors.textSecondary, ...typography.caption },
  contactValue: { color: colors.text, ...typography.label, flexShrink: 1, textAlign: 'right' },
  modalScrim: { flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.42)' },
  contactModal: { gap: Spacing.three, padding: Spacing.four, borderRadius: radius.lg, backgroundColor: colors.background },
  contactError: { color: colors.danger, ...typography.caption },
});
