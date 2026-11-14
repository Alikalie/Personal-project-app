import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AdminCard, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  deleteAnnouncement,
  listAdminAnnouncements,
  saveAnnouncement,
  type AdminAnnouncement,
} from '@/services/contentService';

function nowLocalInput() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function defaultNewAnnouncement(): Omit<AdminAnnouncement, 'id'> {
  return {
    title: '',
    message: '',
    severity: 'info',
    audience: 'all',
    starts_at: nowLocalInput(),
    ends_at: '',
    is_active: true,
  };
}

export default function AdminAnnouncementsScreen() {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Omit<AdminAnnouncement, 'id'>>(defaultNewAnnouncement);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listAdminAnnouncements();
      setItems(rows);
      if (selectedId) {
        const selected = rows.find((item) => item.id === selectedId);
        if (selected) setDraft(toDraft(selected));
      }
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const update = <K extends keyof Omit<AdminAnnouncement, 'id'>>(key: K, value: Omit<AdminAnnouncement, 'id'>[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await saveAnnouncement({
        ...draft,
        starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
        ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      }, selectedId || undefined);
      setSelectedId('');
      setDraft(defaultNewAnnouncement());
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!selectedId || saving) return;
    Alert.alert('Delete this announcement?', 'It will no longer appear in the app.', [
      { text: 'Keep announcement', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void deleteAnnouncement(selectedId).then(() => {
            setSelectedId('');
            setDraft(defaultNewAnnouncement());
            return load();
          }).catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError, 'admin')))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  return (
    <AdminScreen title="Announcements" subtitle="Publish updates for shops">
      {loading && items.length === 0 ? <AdminLoading rows={4} /> : error && items.length === 0 ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => {
                setSelectedId(item.id);
                setDraft(toDraft(item));
              }} style={styles.row} accessibilityRole="button">
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{item.audience} · {item.severity}</Text>
                </View>
                <AdminStatusBadge label={item.is_active ? 'Active' : 'Inactive'} tone={item.is_active ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </View>
          <Button label="New announcement" variant="outline" onPress={() => {
            setSelectedId('');
            setDraft(defaultNewAnnouncement());
          }} />
          <AdminCard>
            <Text style={styles.sectionTitle}>{selectedId ? 'Edit announcement' : 'New announcement'}</Text>
            <Field label="Title" value={draft.title} onChangeText={(value) => update('title', value)} editable={!saving} />
            <Field label="Message" value={draft.message} onChangeText={(value) => update('message', value)} multiline editable={!saving} />
            <Text style={styles.label}>Severity</Text>
            <View style={styles.options}>
              {(['info', 'warning', 'critical'] as const).map((severity) => (
                <Option key={severity} label={severity} selected={draft.severity === severity} onPress={() => update('severity', severity)} />
              ))}
            </View>
            <Text style={styles.label}>Audience</Text>
            <View style={styles.options}>
              {(['all', 'owners'] as const).map((audience) => (
                <Option key={audience} label={audience === 'all' ? 'Everyone' : 'Owners and managers'} selected={draft.audience === audience} onPress={() => update('audience', audience)} />
              ))}
            </View>
            <Field label="Starts (YYYY-MM-DD HH:mm)" value={localDateTime(draft.starts_at)} onChangeText={(value) => update('starts_at', value)} editable={!saving} />
            <Field label="Ends (optional)" value={localDateTime(draft.ends_at)} onChangeText={(value) => update('ends_at', value)} editable={!saving} />
            <View style={styles.switchRow}>
              <Text style={styles.muted}>Active</Text>
              <Switch value={draft.is_active} onValueChange={(value) => update('is_active', value)} disabled={saving} trackColor={{ true: colors.primary }} />
            </View>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={[styles.preview, draft.severity === 'critical' ? styles.critical : draft.severity === 'warning' ? styles.warning : null]}>
              <Text style={styles.rowTitle}>{draft.title || 'Announcement title'}</Text>
              <Text style={styles.muted}>{draft.message || 'Announcement message'}</Text>
            </View>
            <Button label="Save announcement" onPress={() => void save()} loading={saving} disabled={saving || !draft.title.trim() || !draft.message.trim()} />
            {selectedId ? <Button label="Delete announcement" variant="outline" onPress={remove} disabled={saving} /> : null}
          </AdminCard>
        </ScrollView>
      )}
    </AdminScreen>
  );
}

function toDraft(item: AdminAnnouncement): Omit<AdminAnnouncement, 'id'> {
  return { ...item, starts_at: localDateTime(item.starts_at), ends_at: localDateTime(item.ends_at) };
}

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionSelected]} accessibilityRole="button" accessibilityState={{ selected }}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  list: { gap: Spacing.two },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.two, borderRadius: radius.md, backgroundColor: colors.white },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, ...typography.label },
  muted: { color: colors.textSecondary, ...typography.caption },
  sectionTitle: { color: colors.text, ...typography.heading },
  label: { color: colors.text, ...typography.label },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  optionSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, ...typography.caption },
  optionTextSelected: { color: colors.primaryDark },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLabel: { color: colors.text, ...typography.label },
  preview: { padding: Spacing.three, borderRadius: radius.md, backgroundColor: colors.background, gap: 4 },
  critical: { backgroundColor: '#FCECEC' },
  warning: { backgroundColor: '#FFF5E5' },
  error: { color: colors.danger, ...typography.caption },
});
