import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { AdminCard, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  deleteFAQItem,
  listAdminFAQ,
  saveFAQItem,
  type AdminFAQItem,
} from '@/services/contentService';

type FAQDraft = Omit<AdminFAQItem, 'id'>;

export default function AdminFAQScreen() {
  const [items, setItems] = useState<AdminFAQItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<FAQDraft>({ question: '', answer: '', sort_order: 0, is_published: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listAdminFAQ();
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

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await saveFAQItem({ ...draft, sort_order: selectedId ? draft.sort_order : items.length }, selectedId || undefined);
      setSelectedId('');
      setDraft({ question: '', answer: '', sort_order: items.length + 1, is_published: false });
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (item: AdminFAQItem) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveFAQItem({ ...toDraft(item), is_published: !item.is_published }, item.id);
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (saving || target < 0 || target >= items.length) return;
    setSaving(true);
    setError('');
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await Promise.all(reordered.map((item, position) => saveFAQItem({ ...toDraft(item), sort_order: position }, item.id)));
      setItems(reordered.map((item, position) => ({ ...item, sort_order: position })));
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!selectedId || saving) return;
    Alert.alert('Delete this answer?', 'It will be removed from the FAQ.', [
      { text: 'Keep answer', style: 'cancel' },
      {
        text: 'Delete answer',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void deleteFAQItem(selectedId).then(() => {
            setSelectedId('');
            setDraft({ question: '', answer: '', sort_order: 0, is_published: false });
            return load();
          }).catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError, 'admin')))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  return (
    <AdminScreen title="FAQ" subtitle="Manage published help answers">
      {loading && items.length === 0 ? <AdminLoading rows={4} /> : error && items.length === 0 ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.list}>
            {items.map((item, index) => (
              <View key={item.id} style={styles.item}>
                <Pressable onPress={() => {
                  setSelectedId(item.id);
                  setDraft(toDraft(item));
                }} style={styles.itemCopy} accessibilityRole="button">
                  <Text style={styles.question}>{item.question}</Text>
                  <Text style={styles.answer} numberOfLines={2}>{item.answer}</Text>
                </Pressable>
                <View style={styles.itemActions}>
                  <AdminStatusBadge label={item.is_published ? 'Published' : 'Draft'} tone={item.is_published ? 'success' : 'neutral'} />
                  <Pressable onPress={() => void move(index, -1)} disabled={saving || index === 0} style={styles.moveButton} accessibilityRole="button" accessibilityLabel="Move answer up">
                    <ChevronUp size={19} color={colors.primaryDark} />
                  </Pressable>
                  <Pressable onPress={() => void move(index, 1)} disabled={saving || index === items.length - 1} style={styles.moveButton} accessibilityRole="button" accessibilityLabel="Move answer down">
                    <ChevronDown size={19} color={colors.primaryDark} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          <Button label="Add FAQ answer" variant="outline" onPress={() => {
            setSelectedId('');
            setDraft({ question: '', answer: '', sort_order: items.length, is_published: false });
          }} />
          <AdminCard>
            <Text style={styles.sectionTitle}>{selectedId ? 'Edit FAQ answer' : 'New FAQ answer'}</Text>
            <Field label="Question" value={draft.question} onChangeText={(question) => setDraft((current) => ({ ...current, question }))} editable={!saving} />
            <Field label="Answer" value={draft.answer} onChangeText={(answer) => setDraft((current) => ({ ...current, answer }))} multiline editable={!saving} />
            <View style={styles.switchRow}>
              <Text style={styles.answer}>Publish to Help</Text>
              <Switch value={draft.is_published} onValueChange={(is_published) => setDraft((current) => ({ ...current, is_published }))} disabled={saving} trackColor={{ true: colors.primary }} />
            </View>
            <Button label="Save answer" onPress={() => void save()} loading={saving} disabled={saving || !draft.question.trim() || !draft.answer.trim()} />
            {selectedId ? <Button label="Delete answer" variant="outline" onPress={remove} disabled={saving} /> : null}
          </AdminCard>
        </ScrollView>
      )}
    </AdminScreen>
  );
}

function toDraft(item: AdminFAQItem): FAQDraft {
  return {
    question: item.question,
    answer: item.answer,
    sort_order: item.sort_order,
    is_published: item.is_published,
  };
}

const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  list: { gap: Spacing.two },
  item: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, borderRadius: radius.md, backgroundColor: colors.white },
  itemCopy: { flex: 1, minWidth: 0, gap: 4 },
  question: { color: colors.text, ...typography.label },
  answer: { color: colors.textSecondary, ...typography.caption },
  itemActions: { alignItems: 'center', gap: 2 },
  moveButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.text, ...typography.heading },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.danger, ...typography.caption },
});
