import { useState } from 'react';
import { Check, Coins } from 'lucide-react-native';
import { Switch, Text, View } from 'react-native';

import { Card, ListRow } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { usePreferences } from '@/components/PreferencesProvider';
import { useAuth } from '@/components/AuthProvider';
import { colors, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { updateBusiness } from '@/services/settingsService';

const supportedCurrencies = [
  { code: 'SLE', name: 'Sierra Leonean Leone' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'LRD', name: 'Liberian Dollar' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'NGN', name: 'Nigerian Naira' },
];

export default function CurrencySettings() {
  const { ctx, refresh } = useAuth();
  const { decimals, setPreference } = usePreferences();
  const [error, setError] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const currencyCode = ctx?.business?.currencyCode ?? 'SLE';
  const editable = canEditBusiness(ctx?.business?.role);

  const selectCurrency = async (code: string) => {
    if (!editable || !ctx?.businessId || savingCurrency || code === currencyCode) return;
    setError('');
    setSavingCurrency(true);
    try {
      await updateBusiness(ctx.businessId, { currency_code: code });
      await refresh();
    } catch (saveError) {
      console.warn('Unable to update business currency', saveError);
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSavingCurrency(false);
    }
  };

  const toggleDecimals = async (value: boolean) => {
    setError('');
    try {
      await setPreference('decimals', value);
    } catch (saveError) {
      console.warn('Unable to save currency display preference', saveError);
      setError('Could not save this display preference. Please try again.');
    }
  };

  return (
    <SettingsPage title="Currency" subtitle="Choose the business currency. Money remains stored in integer minor units.">
      <Card style={{ padding: 0, borderWidth: 0 }}>
        {supportedCurrencies.map((currency, index) => (
          <View key={currency.code}>
            {index ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} /> : null}
            <ListRow
              icon={currency.code === currencyCode ? Check : Coins}
              title={`${currency.name} (${currency.code})`}
              subtitle={currency.code === currencyCode ? 'Active business currency' : undefined}
              trailingValue={currency.code === currencyCode ? 'Active' : undefined}
              onPress={editable ? () => void selectCurrency(currency.code) : undefined}
            />
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 68 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, ...typography.label }}>Show decimals</Text>
            <Text style={{ color: colors.textSecondary, ...typography.caption, marginTop: 4 }}>
              {decimals ? 'Amounts show hundredths, for example Le 12,500.50.' : 'Amounts are rounded to the nearest Leone, for example Le 12,500.'}
            </Text>
          </View>
          <Switch value={decimals} onValueChange={(value) => void toggleDecimals(value)} trackColor={{ true: colors.primary }} accessibilityLabel="Show decimals in Leone amounts" />
        </View>
      </Card>
      {!editable ? <InfoMessage>Only owners and managers can change the business currency.</InfoMessage> : null}
      {savingCurrency ? <InfoMessage>Saving currency…</InfoMessage> : null}
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
