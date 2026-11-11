import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { useAuth } from '@/components/AuthProvider';
import { usePreferences } from '@/components/PreferencesProvider';
import { Card } from '@/components/ds';
import { InfoMessage, SettingsPage } from '@/components/settings/SettingsPage';
import { colors, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { updateBusiness } from '@/services/settingsService';

export default function NotificationSettings() {
  const { ctx, refresh } = useAuth();
  const { dailySummary, creditReminders, setPreference } = usePreferences();
  const editable = canEditBusiness(ctx?.business?.role);
  const [lowStock, setLowStock] = useState(ctx?.business?.notifyLowStock ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setLowStock(ctx?.business?.notifyLowStock ?? false), [ctx?.business?.notifyLowStock]);

  const setLowStockAlerts = async (value: boolean) => {
    if (!ctx?.businessId || !editable || loading) return;
    setLoading(true);
    setError('');
    try {
      await updateBusiness(ctx.businessId, { notify_low_stock: value });
      setLowStock(value);
      await refresh();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  const setLocalPreference = async (key: 'dailySummary' | 'creditReminders', value: boolean) => {
    setError('');
    try {
      await setPreference(key, value);
    } catch (saveError) {
      console.warn('Unable to save notification preference', saveError);
      setError('Could not save this preference. Please try again.');
    }
  };

  return (
    <SettingsPage title="Notifications" subtitle="Choose which business reminders are enabled.">
      {!editable ? <InfoMessage>Only owners and managers can change business notification settings.</InfoMessage> : null}
      <Card style={styles.group}>
        <NotificationRow title="Low-stock alerts" description="Show reminders when products need a restock." value={lowStock} disabled={!editable || loading} onChange={(value) => void setLowStockAlerts(value)} />
        <View style={styles.divider} />
        <NotificationRow title="Daily sales summary" description="Coming soon" value={dailySummary} onChange={(value) => void setLocalPreference('dailySummary', value)} />
        <View style={styles.divider} />
        <NotificationRow title="Credit reminders" description="Coming soon" value={creditReminders} onChange={(value) => void setLocalPreference('creditReminders', value)} />
      </Card>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}

function NotificationRow({ title, description, value, disabled = false, onChange }: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, ...typography.label }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, ...typography.caption, marginTop: 4 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} accessibilityLabel={title} />
    </View>
  );
}

const styles = {
  group: { paddingVertical: 0, borderWidth: 0 },
  row: { minHeight: 68, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
};
