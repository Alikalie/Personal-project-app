import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { AdminCard, AdminScreen } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import {
  getDefaultSubscriptionSettings,
  parseSubscriptionSettings,
  planUsageMetrics,
  type PlanId,
  type PlanLimits,
  type PlanUsageMetric,
  type SubscriptionSettings,
} from '@/constants/subscription';
import { plans } from '@/constants/plans';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { currencyFractionDigits, parseMoneyToMinorUnits } from '@/lib/money';
import { listAppSettings, saveAppSetting } from '@/services/contentService';

type PriceDraft = Record<PlanId, string>;
type LimitDraft = Record<PlanId, Record<PlanUsageMetric, string>>;

function priceInput(minor: number, currencyCode: string): string {
  const digits = currencyFractionDigits(currencyCode);
  return (minor / 10 ** digits).toFixed(digits);
}

function draftsFromSettings(settings: SubscriptionSettings): { prices: PriceDraft; limits: LimitDraft } {
  const prices = {} as PriceDraft;
  const limits = {} as LimitDraft;
  for (const plan of plans) {
    prices[plan.id] = priceInput(settings.plans[plan.id].monthlyPriceMinor, settings.priceCurrencyCode);
    limits[plan.id] = Object.fromEntries(planUsageMetrics.map(({ id }) => [
      id,
      settings.plans[plan.id].limits[id] === null ? '' : String(settings.plans[plan.id].limits[id]),
    ])) as Record<PlanUsageMetric, string>;
  }
  return { prices, limits };
}

export default function AdminSubscriptionsScreen() {
  const { ctx } = useAuth();
  const { refresh: refreshPublicSettings } = usePublicAppSettings();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [settings, setSettings] = useState(getDefaultSubscriptionSettings);
  const [prices, setPrices] = useState<PriceDraft>(() => draftsFromSettings(getDefaultSubscriptionSettings()).prices);
  const [limits, setLimits] = useState<LimitDraft>(() => draftsFromSettings(getDefaultSubscriptionSettings()).limits);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!superAdmin) return;
    setLoading(true);
    setError('');
    try {
      const row = (await listAppSettings()).find((setting) => setting.key === 'subscription_plans');
      const next = row ? parseSubscriptionSettings(row.value) : getDefaultSubscriptionSettings();
      const drafts = draftsFromSettings(next);
      setSettings(next);
      setPrices(drafts.prices);
      setLimits(drafts.limits);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [superAdmin]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const updateLimit = (planId: PlanId, metric: PlanUsageMetric, value: string) => {
    setLimits((current) => ({
      ...current,
      [planId]: { ...current[planId], [metric]: value.replace(/[^\d]/g, '') },
    }));
    setSaved(false);
  };

  const save = async () => {
    if (!superAdmin || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const next: SubscriptionSettings = {
        ...settings,
        plans: { ...settings.plans },
      };
      for (const plan of plans) {
        const monthlyPriceMinor = parseMoneyToMinorUnits(prices[plan.id].trim(), settings.priceCurrencyCode);
        const planLimits = {} as PlanLimits;
        for (const { id } of planUsageMetrics) {
          const value = limits[plan.id][id].trim();
          if (!value) {
            planLimits[id] = null;
            continue;
          }
          const parsed = Number(value);
          if (!Number.isSafeInteger(parsed) || parsed < 0) {
            throw new Error(`${plan.name}: enter a whole-number ${id} limit or leave it blank for unlimited.`);
          }
          planLimits[id] = parsed;
        }
        next.plans[plan.id] = { monthlyPriceMinor, limits: planLimits };
      }

      await saveAppSetting({
        key: 'subscription_plans',
        value: next,
        description: 'Public subscription visibility, plan prices, and plan usage limits',
        is_public: true,
      });
      setSettings(next);
      const drafts = draftsFromSettings(next);
      setPrices(drafts.prices);
      setLimits(drafts.limits);
      await refreshPublicSettings();
      setSaved(true);
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title="Subscription plans" subtitle={superAdmin ? 'Control visibility, pricing, and plan allowances' : 'Super admin access required'}>
      {!superAdmin ? <Text style={styles.note}>Only a super admin can manage subscriptions.</Text> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AdminCard>
            <View style={styles.switchRow}>
              <View style={styles.copy}>
                <Text style={styles.label}>Show subscription screen</Text>
                <Text style={styles.note}>Off by default. When turned on, business owners can view plan prices and allowances.</Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(enabled) => {
                  setSettings((current) => ({ ...current, enabled }));
                  setSaved(false);
                }}
                disabled={loading || saving}
                trackColor={{ true: colors.primary }}
                accessibilityLabel="Show subscription and pricing screen"
              />
            </View>
            <Text style={styles.note}>Prices use Sierra Leonean leones (SLE). Usage allowances are saved and displayed, but are not enforced.</Text>
          </AdminCard>

          {plans.map((plan) => (
            <AdminCard key={plan.id}>
              <Text style={styles.sectionTitle}>{plan.name}</Text>
              <Field
                label={`Monthly price (SLE)`}
                value={prices[plan.id]}
                onChangeText={(value) => {
                  setPrices((current) => ({ ...current, [plan.id]: value.replace(/[^\d.]/g, '') }));
                  setSaved(false);
                }}
                keyboardType="decimal-pad"
                editable={!loading && !saving}
              />
              <Text style={styles.label}>Usage limits (leave blank for unlimited)</Text>
              {planUsageMetrics.map((metric) => (
                <Field
                  key={metric.id}
                  label={metric.label}
                  value={limits[plan.id][metric.id]}
                  onChangeText={(value) => updateLimit(plan.id, metric.id, value)}
                  keyboardType="number-pad"
                  editable={!loading && !saving}
                />
              ))}
            </AdminCard>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.saved}>Subscription settings saved.</Text> : null}
          <Button label="Save subscription settings" onPress={() => void save()} loading={saving} disabled={loading || saving} />
        </ScrollView>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  switchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  copy: { flex: 1, gap: 4 },
  label: { color: colors.text, ...typography.label },
  note: { color: colors.textSecondary, ...typography.caption, lineHeight: 19 },
  sectionTitle: { color: colors.text, ...typography.heading, marginBottom: Spacing.three },
  error: { color: colors.danger, ...typography.caption },
  saved: { color: colors.primaryDark, ...typography.caption },
});
