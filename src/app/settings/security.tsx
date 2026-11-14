import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { useSecuritySettings } from '@/components/SecurityGuard';
import { Card } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { colors, Spacing, typography } from '@/constants/theme';

export default function SecuritySettings() {
  const { appLockEnabled, setAppLockEnabled } = useSecuritySettings();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supported = Platform.OS === 'android' || Platform.OS === 'ios';

  const toggleLock = async (enabled: boolean) => {
    if (!supported || saving) return;
    setSaving(true);
    setError('');
    try {
      if (enabled) {
        const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
        if (enrolled === LocalAuthentication.SecurityLevel.NONE) {
          throw new Error('Set up a device screen lock or biometrics before enabling app lock.');
        }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm MiShop app lock' });
        if (!result.success) throw new Error('Authentication was not completed. App lock was not enabled.');
      }
      await setAppLockEnabled(enabled);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update app lock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPage title="Security" subtitle="Protect access to this device and its MiShop data.">
      <Card style={{ padding: 0, borderWidth: 0 }}>
        <View style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, ...typography.label }}>Require device authentication</Text>
            <Text style={{ color: colors.textSecondary, ...typography.caption, marginTop: 4 }}>
              Lock MiShop when it is reopened after leaving the app.
            </Text>
          </View>
          <Switch
            value={supported && appLockEnabled}
            onValueChange={(value) => void toggleLock(value)}
            disabled={!supported || saving}
            trackColor={{ true: colors.primary }}
            accessibilityLabel="Require device authentication to open MiShop"
          />
        </View>
      </Card>
      <InfoMessage>
        Screen capture is blocked while MiShop is open on Android and iOS. Device authentication can use biometrics or the device passcode.
      </InfoMessage>
      {!supported ? <InfoMessage>App lock is available in the Android and iOS apps.</InfoMessage> : null}
      {saving ? <InfoMessage>Updating security settings…</InfoMessage> : null}
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
