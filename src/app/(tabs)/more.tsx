import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell,
  Building2,
  CircleHelp,
  CreditCard,
  FileText,
  Globe2,
  KeyRound,
  LogOut,
  Shield,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { Badge, Card, ListRow, SectionHeader } from '@/components/ds';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { isPlatformAdmin } from '@/lib/permissions';
import { clearOnboarding } from '@/services/onboardingStore';
import { clearProductImageCache } from '@/services/productService';
import { clearSettingsCaches, signOut } from '@/services/settingsService';
import { useCart } from '@/components/CartProvider';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?';
}

export default function More() {
  const { ctx } = useAuth();
  const { clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const role = ctx?.business?.role ?? null;
  const admin = ctx?.platformAdminLevel ?? null;

  const confirmLogout = () => Alert.alert('Log out?', 'You will need to sign in again to continue.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Log out',
      style: 'destructive',
      onPress: () => {
        if (loggingOut) return;
        setLoggingOut(true);
        void signOut().then(() => {
          clearCart();
          clearOnboarding();
          clearProductImageCache();
          clearSettingsCaches();
          router.replace('/welcome');
        }).catch((error: unknown) => {
          Alert.alert('Could not log out', error instanceof Error ? error.message : 'Please try again.');
        }).finally(() => setLoggingOut(false));
      },
    },
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>More</Text>
        <Pressable
          onPress={() => router.push('/settings/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile and business details"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(ctx?.name ?? '')}</Text></View>
              <View style={styles.profileDetails}>
                <Text style={styles.name} numberOfLines={1}>{ctx?.name || 'Your profile'}</Text>
                <Text style={styles.email} numberOfLines={1}>{ctx?.email ?? ''}</Text>
              </View>
              <Badge label={role ? `${role[0].toUpperCase()}${role.slice(1)}` : 'No role'} tone="success" />
            </View>
            <Text style={styles.codeLine}>ID: {ctx?.profileCode ?? 'Not available'}</Text>
            <Text style={styles.businessLine}>{ctx?.businessName || 'Business not set up'}</Text>
            <Text style={styles.codeLine}>Business ID: {ctx?.businessCode ?? 'Not available'}</Text>
          </Card>
        </Pressable>

        <SettingsGroup title="Account">
          <ListRow title="My profile" icon={UserRound} chevron onPress={() => router.push('/settings/profile')} />
          <View style={styles.divider} />
          <ListRow title="Change password" icon={KeyRound} chevron onPress={() => router.push('/settings/password')} />
        </SettingsGroup>
        <SettingsGroup title="Business">
          <ListRow title="Business profile" icon={Building2} chevron onPress={() => router.push('/settings/business')} />
          <View style={styles.divider} />
          <ListRow title="Receipt settings" icon={FileText} chevron onPress={() => router.push('/settings/receipt')} />
          <View style={styles.divider} />
          <ListRow title="Currency" icon={Globe2} chevron onPress={() => router.push('/settings/currency')} />
          <View style={styles.divider} />
          <ListRow title="Notifications" subtitle={role === 'cashier' ? 'Some settings are read-only' : undefined} icon={Bell} chevron onPress={() => router.push('/settings/notifications')} />
        </SettingsGroup>
        <SettingsGroup title="Help">
          {role === 'owner' ? <><ListRow title="Subscription and pricing" icon={CreditCard} chevron onPress={() => router.push('/settings/subscription')} /><View style={styles.divider} /></> : null}
          <ListRow title="Help and support" icon={CircleHelp} chevron onPress={() => router.push('/settings/help')} />
        </SettingsGroup>
        {isPlatformAdmin(admin) ? (
          <SettingsGroup title="Admin">
            <ListRow title="Admin panel" subtitle="Platform tools" icon={Shield} badge={{ label: admin === 'super_admin' ? 'Super admin' : 'Support', tone: 'neutral' }} chevron onPress={() => Alert.alert('Admin panel', 'Platform tools are not available in this app version.')} />
          </SettingsGroup>
        ) : null}
        <Card style={styles.footer}>
          <Pressable
            onPress={confirmLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out of SaloneBiz Manager"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            style={styles.logout}
          >
            <LogOut size={20} color={colors.danger} />
            <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
          <Text style={styles.version}>Version {Constants.expoConfig?.version ?? '—'}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionHeader title={title} />
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.four, paddingBottom: 36, gap: Spacing.four },
  title: { color: colors.text, ...typography.title },
  profileCard: { gap: Spacing.two, borderWidth: 0 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 17 },
  profileDetails: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.heading },
  email: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  codeLine: { color: colors.textSecondary, ...typography.caption },
  businessLine: { color: colors.text, ...typography.label },
  group: { gap: Spacing.two },
  groupCard: { padding: Spacing.two, gap: 0, borderWidth: 0 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.three },
  footer: { padding: Spacing.two },
  logout: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three },
  logoutText: { color: colors.danger, ...typography.label },
  version: { marginTop: Spacing.two, paddingHorizontal: Spacing.three, color: colors.textSecondary, ...typography.caption },
  pressed: { opacity: 0.82 },
});
