import * as Clipboard from 'expo-clipboard';
import { Lock, Copy } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { ContactInfoHint } from '@/components/ContactInfoHint';
import { Card, IconButton } from '@/components/ds';
import { SettingsPage, InfoMessage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { colors, typography } from '@/constants/theme';
import { isValidPhoneNumber } from '@/lib/contactValidation';
import { friendlyErrorMessage } from '@/lib/errors';
import { updateProfile } from '@/services/settingsService';

export default function ProfileSettings() {
  const { ctx, refresh } = useAuth();
  const [name, setName] = useState(ctx?.name ?? '');
  const [phone, setPhone] = useState(ctx?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dirty = useMemo(() => name !== (ctx?.name ?? '') || phone !== (ctx?.phone ?? ''), [ctx?.name, ctx?.phone, name, phone]);
  const disablePrevention = useUnsavedChanges(dirty);

  const save = async () => {
    const cleanName = name.trim();
    if (cleanName.length < 2) return setError('Enter your full name using at least 2 characters.');
    if (phone.trim() && !isValidPhoneNumber(phone)) return setError('Enter a valid phone number with 8 to 15 digits, or leave it blank.');
    if (!ctx) return setError('Your account details are not available. Please sign in again.');
    setLoading(true);
    setError('');
    try {
      await updateProfile(ctx.id, { full_name: cleanName, phone: phone.trim() });
      await refresh();
      disablePrevention();
      Alert.alert('Profile updated', 'Your profile details have been saved.');
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!ctx?.profileCode) return;
    try {
      await Clipboard.setStringAsync(ctx.profileCode);
      Alert.alert('Copied', 'Your profile ID has been copied.');
    } catch (copyError) {
      setError(friendlyErrorMessage(copyError));
    }
  };

  return (
    <SettingsPage
      title="My profile"
      subtitle="Keep your account details up to date."
      footer={<Button label="Save changes" onPress={() => void save()} loading={loading} disabled={!dirty || loading} />}
    >
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
      <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
      <ContactInfoHint>
        Use a phone number you can access and include your country code. It may be used for future verification and account recovery.
      </ContactInfoHint>
      <Card style={{ padding: 0, borderWidth: 0 }}>
        <View style={styles.readOnlyRow}>
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Email address</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{ctx?.email ?? 'Not available'}</Text>
          </View>
          <Lock size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.divider} />
        <View style={styles.readOnlyRow}>
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Profile ID</Text>
            <Text style={styles.detailValue}>{ctx?.profileCode ?? 'Not available'}</Text>
          </View>
          <IconButton icon={Copy} label="Copy profile ID" onPress={() => void copyCode()} disabled={!ctx?.profileCode} />
        </View>
      </Card>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}

const styles = {
  readOnlyRow: { minHeight: 64, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 16 },
  detailText: { flex: 1, minWidth: 0, gap: 4 },
  detailLabel: { color: colors.text, ...typography.label },
  detailValue: { color: colors.textSecondary, ...typography.body },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
};
