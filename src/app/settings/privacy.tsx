import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { colors, Spacing, typography } from '@/constants/theme';
import { getMarketingConsent, setMarketingConsent } from '@/services/authService';

export default function PrivacySettings() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConsent(await getMarketingConsent());
    } catch {
      setError('Email preferences could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const toggle = async (value: boolean) => {
    if (saving || loading) return;
    setSaving(true);
    setError('');
    try {
      await setMarketingConsent(value);
      setConsent(value);
    } catch {
      setError('Your email preference could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPage title="Email preferences" subtitle="Control optional MiShop product and business updates.">
      <Card style={{ padding: 0, borderWidth: 0 }}>
        <View style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, ...typography.label }}>Marketing emails</Text>
            <Text style={{ color: colors.textSecondary, ...typography.caption, marginTop: 4 }}>
              Receive optional product news and business tips from MiShop.
            </Text>
          </View>
          <Switch
            value={consent}
            onValueChange={(value) => void toggle(value)}
            disabled={loading || saving}
            trackColor={{ true: colors.primary }}
            accessibilityLabel="Receive optional MiShop marketing emails"
          />
        </View>
      </Card>
      <InfoMessage>Your choice is optional and can be changed here at any time.</InfoMessage>
      {loading ? <InfoMessage>Loading your preference…</InfoMessage> : null}
      {saving ? <InfoMessage>Saving your preference…</InfoMessage> : null}
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
