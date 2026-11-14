import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  deleteAppReleaseDraft,
  listAppReleases,
  publishAppRelease,
  saveAppReleaseDraft,
  type AppRelease,
  type AppReleaseInput,
} from '@/services/releaseAdminService';

const emptyDraft: AppReleaseInput = {
  platform: 'android',
  version: '',
  min_supported_version: '',
  force_update: false,
  update_url: '',
  release_notes: '',
};

export default function AdminReleasesScreen() {
  const { ctx } = useAuth();
  const allowed = ctx?.platformAdminLevel === 'super_admin';
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<AppReleaseInput>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listAppReleases();
      setReleases(rows);
      const current = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.status === 'draft') ?? null;
      setSelectedId(current?.id ?? '');
      setDraft(current ? {
        platform: current.platform,
        version: current.version,
        min_supported_version: current.min_supported_version,
        force_update: current.force_update,
        update_url: current.update_url ?? '',
        release_notes: current.release_notes ?? '',
      } : emptyDraft);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const update = <K extends keyof AppReleaseInput>(key: K, value: AppReleaseInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const newDraft = () => {
    setSelectedId('');
    setDraft(emptyDraft);
    setError('');
  };

  const save = async (): Promise<string | null> => {
    if (!allowed || saving) return null;
    setSaving(true);
    setError('');
    try {
      const id = await saveAppReleaseDraft(draft, selectedId || undefined);
      setSelectedId(id);
      await load();
      return id;
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!allowed || saving) return;
    const id = selectedId || await save();
    if (!id) return;
    const warning = draft.force_update
      ? 'This release will block users below the minimum supported version.'
      : 'This release will become the latest version for this platform.';
    Alert.alert('Publish this release?', warning, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish',
        onPress: () => {
          setSaving(true);
          void publishAppRelease(id).then(load).catch((publishError: unknown) => {
            setError(friendlyErrorMessage(publishError, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const removeDraft = () => {
    const current = releases.find((item) => item.id === selectedId);
    if (!allowed || !current || current.status !== 'draft' || saving) return;
    Alert.alert('Delete this release draft?', 'Only the unpublished draft will be removed.', [
      { text: 'Keep draft', style: 'cancel' },
      {
        text: 'Delete draft',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void deleteAppReleaseDraft(current.id).then(() => {
            setSelectedId('');
            return load();
          }).catch((deleteError: unknown) => {
            setError(friendlyErrorMessage(deleteError, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const selected = releases.find((item) => item.id === selectedId) ?? null;

  return (
    <AdminScreen title="App versions" subtitle={allowed ? 'Manage release updates' : 'Super admin access only'}>
      {!allowed ? <Text style={styles.muted}>Only super admins can manage app releases.</Text> : loading && releases.length === 0 ? <AdminLoading rows={4} /> : error && releases.length === 0 ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.list}>
            {releases.map((release) => (
              <Pressable key={release.id} onPress={() => {
                setSelectedId(release.id);
                setDraft({
                  platform: release.platform,
                  version: release.version,
                  min_supported_version: release.min_supported_version,
                  force_update: release.force_update,
                  update_url: release.update_url ?? '',
                  release_notes: release.release_notes ?? '',
                });
              }} style={styles.releaseRow} accessibilityRole="button">
                <View style={styles.releaseCopy}>
                  <Text style={styles.releaseTitle}>{release.platform.toUpperCase()} · {release.version}</Text>
                  <Text style={styles.muted}>Minimum: {release.min_supported_version}</Text>
                </View>
                <AdminStatusBadge label={release.status} tone={release.status === 'published' ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
          <Button label="Create new draft" variant="outline" onPress={newDraft} />
          {selected?.status === 'published' ? (
            <AdminCard><Text style={styles.muted}>Published releases are read-only.</Text></AdminCard>
          ) : (
            <AdminCard>
              <Text style={styles.sectionTitle}>{selected ? 'Edit release draft' : 'New release draft'}</Text>
              <View style={styles.platforms}>
                {(['android', 'ios'] as const).map((platform) => (
                  <Pressable key={platform} onPress={() => update('platform', platform)} style={[styles.platform, draft.platform === platform && styles.platformSelected]} accessibilityRole="button" accessibilityState={{ selected: draft.platform === platform }}>
                    <Text style={[styles.platformText, draft.platform === platform && styles.platformTextSelected]}>{platform === 'android' ? 'Android' : 'iOS'}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Version (x.y.z)" value={draft.version} onChangeText={(value) => update('version', value)} editable={!saving} />
              <Field label="Minimum supported version (x.y.z)" value={draft.min_supported_version} onChangeText={(value) => update('min_supported_version', value)} editable={!saving} />
              <Field label="Update URL" value={draft.update_url ?? ''} onChangeText={(value) => update('update_url', value)} autoCapitalize="none" keyboardType="url" editable={!saving} />
              <Field label="Release notes" value={draft.release_notes ?? ''} onChangeText={(value) => update('release_notes', value)} multiline editable={!saving} />
              <View style={styles.switchRow}>
                <Text style={styles.muted}>Force older versions to update</Text>
                <Switch value={draft.force_update} onValueChange={(value) => update('force_update', value)} disabled={saving} trackColor={{ true: colors.primary }} />
              </View>
              <Button label="Save draft" onPress={() => void save()} loading={saving} disabled={saving} />
              <Button label="Publish" variant="outline" onPress={() => void publish()} loading={saving} disabled={saving || !draft.version || !draft.min_supported_version} />
              {selected?.status === 'draft' ? <Button label="Delete draft" variant="outline" onPress={removeDraft} disabled={saving} /> : null}
            </AdminCard>
          )}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  list: { gap: Spacing.two },
  releaseRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.two, backgroundColor: colors.white, borderRadius: radius.md },
  releaseCopy: { flex: 1 },
  releaseTitle: { color: colors.text, ...typography.label },
  muted: { color: colors.textSecondary, ...typography.caption },
  sectionTitle: { color: colors.text, ...typography.heading },
  platforms: { flexDirection: 'row', gap: Spacing.two },
  platform: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl },
  platformSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  platformText: { color: colors.textSecondary, ...typography.label },
  platformTextSelected: { color: colors.primaryDark },
  switchRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  error: { color: colors.danger, ...typography.caption },
});
