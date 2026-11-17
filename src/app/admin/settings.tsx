import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminScreen } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAppSettings, saveAppSetting, type AppSettingRow } from '@/services/contentService';
import { getEmailVerificationRequired, setEmailVerificationRequired } from '@/services/emailVerificationService';

export default function AdminSettingsScreen() {
  const { ctx } = useAuth();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [settings, setSettings] = useState<AppSettingRow[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [key, setKey] = useState('');
  const [valueJson, setValueJson] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verificationRequired, setVerificationRequired] = useState<boolean | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const setSetting = (setting: AppSettingRow) => {
    setSelectedKey(setting.key);
    setKey(setting.key);
    setValueJson(JSON.stringify(setting.value, null, 2));
    setDescription(setting.description ?? '');
    setIsPublic(setting.is_public);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listAppSettings();
      setSettings(rows);
      if (selectedKey) {
        const selected = rows.find((item) => item.key === selectedKey);
        if (selected) setSetting(selected);
      }
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  const loadVerificationSetting = useCallback(async () => {
    if (!superAdmin) return;
    setVerificationLoading(true);
    setVerificationError('');
    try {
      setVerificationRequired(await getEmailVerificationRequired());
    } catch (loadError) {
      setVerificationRequired(null);
      setVerificationError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setVerificationLoading(false);
    }
  }, [superAdmin]);

  useFocusEffect(useCallback(() => {
    void load();
    void loadVerificationSetting();
  }, [load, loadVerificationSetting]));

  const togglePublic = (next: boolean) => {
    if (!superAdmin || saving) return;
    if (next && !isPublic) {
      Alert.alert('Make this setting public?', 'Anyone using MiShop can read this value without signing in.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Make public', onPress: () => setIsPublic(true) },
      ]);
      return;
    }
    setIsPublic(next);
  };

  const save = async () => {
    if (!superAdmin || saving) return;
    let value: unknown;
    try {
      value = JSON.parse(valueJson);
    } catch {
      setError('Enter valid JSON before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const row = { key: key.trim(), value, description: description.trim() || null, is_public: isPublic };
      await saveAppSetting(row);
      setSelectedKey(row.key);
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const applyVerificationSetting = async (enabled: boolean) => {
    if (!superAdmin || verificationSaving) return;
    setVerificationSaving(true);
    setVerificationError('');
    try {
      await setEmailVerificationRequired(enabled);
      setVerificationRequired(enabled);
    } catch (saveError) {
      setVerificationError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setVerificationSaving(false);
    }
  };

  const confirmVerificationSetting = (enabled: boolean) => {
    if (!superAdmin || verificationRequired === null || verificationSaving) return;
    Alert.alert(
      enabled ? 'Require email verification?' : 'Turn off email verification?',
      enabled
        ? 'New email and password signups must confirm their email before signing in. Existing accounts are not deleted.'
        : 'New email and password signups can sign in without confirming email. Use this only temporarily; existing accounts are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: enabled ? 'Require verification' : 'Turn off', onPress: () => void applyVerificationSetting(enabled) },
      ],
    );
  };

  return (
    <AdminScreen title="App settings" subtitle={superAdmin ? 'Super admin can edit settings' : 'Read-only settings'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {superAdmin ? (
          <AdminCard>
            <Text style={styles.sectionTitle}>Email verification</Text>
            <Text style={styles.muted}>
              Control email confirmation for new email and password signups. Supabase Auth continues to validate email syntax.
            </Text>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.label}>Require email confirmation</Text>
                <Text style={styles.muted}>
                  {verificationRequired === null
                    ? 'Current status is unavailable.'
                    : verificationRequired
                      ? 'New signups must verify their email before signing in.'
                      : 'New signups can continue without confirming their email.'}
                </Text>
              </View>
              <Switch
                value={verificationRequired ?? false}
                onValueChange={confirmVerificationSetting}
                disabled={verificationLoading || verificationSaving || verificationRequired === null}
                trackColor={{ true: colors.primary }}
                accessibilityLabel="Require email confirmation for new signups"
              />
            </View>
            {verificationLoading ? <Text style={styles.muted}>Checking Supabase Auth setting…</Text> : null}
            {verificationError ? <Text style={styles.error}>{verificationError}</Text> : null}
            <Text style={styles.muted}>
              This changes the hosted Supabase Auth setting for new signups only. It does not confirm that an email address is reachable or owned by the user.
            </Text>
          </AdminCard>
        ) : null}
        {loading && settings.length === 0 ? <AdminLoading rows={4} /> : error && settings.length === 0 ? (
          <AdminError message={error} onRetry={() => void load()} />
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.list}>
              {settings.map((setting) => (
                <Pressable key={setting.key} onPress={() => setSetting(setting)} style={styles.row} accessibilityRole="button">
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{setting.key}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{JSON.stringify(setting.value)}</Text>
                  </View>
                  <Text style={setting.is_public ? styles.public : styles.private}>{setting.is_public ? 'Public' : 'Private'}</Text>
                </Pressable>
              ))}
            </View>
            {selectedKey ? (
              <AdminCard>
                <Text style={styles.sectionTitle}>Edit setting</Text>
                <Field label="Key" value={key} onChangeText={setKey} editable={false} />
                <Text style={styles.label}>Value (JSON)</Text>
                <TextInput value={valueJson} onChangeText={setValueJson} editable={superAdmin && !saving} multiline textAlignVertical="top" style={styles.jsonInput} accessibilityLabel="Setting value JSON" />
                <Field label="Description" value={description} onChangeText={setDescription} editable={superAdmin && !saving} />
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.label}>Public</Text>
                    <Text style={styles.muted}>Public values are visible before sign-in.</Text>
                  </View>
                  <Switch value={isPublic} onValueChange={togglePublic} disabled={!superAdmin || saving} trackColor={{ true: colors.primary }} />
                </View>
                {superAdmin ? <Button label="Save setting" onPress={() => void save()} loading={saving} disabled={saving} /> : null}
              </AdminCard>
            ) : (
              <Text style={styles.muted}>Select a setting to view its value.</Text>
            )}
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  list: { gap: Spacing.two },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.two, borderRadius: radius.md, backgroundColor: colors.white },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typography.label },
  muted: { color: colors.textSecondary, ...typography.caption },
  public: { color: colors.primaryDark, ...typography.caption },
  private: { color: colors.textSecondary, ...typography.caption },
  sectionTitle: { color: colors.text, ...typography.heading },
  label: { color: colors.text, ...typography.label },
  jsonInput: { minHeight: 140, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.three, color: colors.text, fontFamily: 'monospace' },
  switchRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  switchCopy: { flex: 1 },
  error: { color: colors.danger, ...typography.caption },
});
