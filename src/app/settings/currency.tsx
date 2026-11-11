import { useState } from 'react';
import { Check, Coins } from 'lucide-react-native';
import { Switch, Text, View } from 'react-native';

import { Card, ListRow } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { usePreferences } from '@/components/PreferencesProvider';
import { colors, typography } from '@/constants/theme';

export default function CurrencySettings() {
  const { decimals, setPreference } = usePreferences();
  const [error, setError] = useState('');
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
    <SettingsPage title="Currency" subtitle="Currency is displayed locally. Stored money values remain integer minor units.">
      <Card style={{ padding: 0, borderWidth: 0 }}>
        <ListRow icon={Coins} title="New Leone (SLE)" subtitle="Active business currency" trailingValue="Active" />
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
      <InfoMessage>More currencies are coming.</InfoMessage>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
