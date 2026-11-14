import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminScreen } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listAppSettings, saveAppSetting, type AppSettingRow } from '@/services/contentService';

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

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const setSetting = (setting: AppSettingRow) => {
    setSelectedKey(setting.key);
    setKey(setting.key);
    setValueJson(JSON.stringify(setting.value, null, 2));
    setDescription(setting.description ?? '');
    setIsPublic(setting.is_public);
  };

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

  return (
    <AdminScreen title="App settings" subtitle={superAdmin ? 'Super admin can edit settings' : 'Read-only settings'}>
      {loading && settings.length === 0 ? <AdminLoading rows={4} /> : error && settings.length === 0 ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      )}
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
