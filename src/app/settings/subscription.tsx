import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { plans } from '@/constants/plans';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { canManageBilling } from '@/lib/permissions';
import { formatSLE } from '@/lib/money';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';

export default function SubscriptionSettings() {
  const { ctx } = useAuth();
  const { settings } = usePublicAppSettings();
  const canManage = canManageBilling(ctx?.business?.role);

  const contactUs = async () => {
    try {
      await Linking.openURL(`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`${settings.appName} plan upgrade`)}`);
    } catch (error) {
      console.warn('Unable to open support email', error);
    }
  };

  return (
    <SettingsPage title="Subscription and pricing" subtitle="Plan options and pricing are placeholders for now.">
      {!canManage ? <InfoMessage>Only the business owner can manage subscription options.</InfoMessage> : null}
      <Card style={styles.current}>
        <Text style={styles.kicker}>CURRENT PLAN</Text>
        <Text style={styles.currentTitle}>Free trial</Text>
        <Text style={styles.description}>You are currently using the free trial.</Text>
      </Card>
      <View style={styles.plans}>
        {plans.map((plan) => (
          <Card key={plan.name} style={styles.plan}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.price}>{formatSLE(plan.monthlyPriceMinor)}<Text style={styles.period}> / month</Text></Text>
            <Text style={styles.placeholder}>Placeholder price</Text>
            <View style={styles.features}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.feature}>
                  <Check size={16} color={colors.primary} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
            {canManage ? <Button label="Contact us to upgrade" variant="outline" onPress={() => void contactUs()} /> : null}
          </Card>
        ))}
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  current: { backgroundColor: colors.primaryLight },
  kicker: { color: colors.primaryDark, ...typography.caption },
  currentTitle: { color: colors.text, ...typography.heading, marginTop: 6 },
  description: { color: colors.textSecondary, ...typography.body, marginTop: 4 },
  plans: { gap: Spacing.three },
  plan: { gap: Spacing.three, borderRadius: radius.lg },
  planName: { color: colors.text, ...typography.heading },
  price: { color: colors.primaryDark, fontSize: 22, fontWeight: '800' },
  period: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  placeholder: { color: colors.textSecondary, ...typography.caption },
  features: { gap: Spacing.two },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  featureText: { flex: 1, color: colors.text, ...typography.body },
});
