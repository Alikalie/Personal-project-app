import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { MarkdownView } from '@/components/MarkdownView';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { getAdminOverview } from '@/services/adminService';
import {
  createLegalDraft,
  deleteLegalDraft,
  getLegalAcceptanceCounts,
  listLegalDocumentVersions,
  publishLegalDraft,
  saveLegalDraft,
  type LegalVersionRow,
} from '@/services/legalAdminService';
import type { LegalDocumentType } from '@/services/legalService';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminLegalScreen() {
  const { ctx } = useAuth();
  const superAdmin = ctx?.platformAdminLevel === 'super_admin';
  const [documents, setDocuments] = useState<LegalVersionRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [acceptedCount, setAcceptedCount] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(today);

  const selected = documents.find((document) => document.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, overview] = await Promise.all([listLegalDocumentVersions(), getAdminOverview()]);
      setDocuments(rows);
      setTotalUsers(overview.total_users);
      const current = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.status === 'draft') ?? rows[0] ?? null;
      setSelectedId(current?.id ?? '');
      setTitle(current?.title ?? '');
      setBody(current?.body_md ?? '');
      setDirty(false);
      if (current?.status === 'published') {
        setAcceptedCount(await getLegalAcceptanceCounts(current.doc_type, current.version));
      } else {
        const published = rows.find((row) => row.doc_type === current?.doc_type && row.status === 'published');
        setAcceptedCount(published ? await getLegalAcceptanceCounts(published.doc_type, published.version) : null);
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

  const selectDocument = (document: LegalVersionRow) => {
    if (dirty) {
      Alert.alert('Discard unsaved changes?', 'Your draft has changes that are not saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setDocument(document) },
      ]);
      return;
    }
    setDocument(document);
  };

  const setDocument = (document: LegalVersionRow) => {
    setSelectedId(document.id);
    setTitle(document.title);
    setBody(document.body_md);
    setDirty(false);
    setPreview(false);
  };

  const save = async () => {
    if (!selected || selected.status !== 'draft' || !dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveLegalDraft(selected.id, title, body);
      setDirty(false);
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const create = async (type: LegalDocumentType) => {
    if (!superAdmin || saving) return;
    setSaving(true);
    setError('');
    try {
      await createLegalDraft(type);
      await load();
    } catch (createError) {
      setError(friendlyErrorMessage(createError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = () => {
    if (!selected || selected.status !== 'draft' || saving) return;
    Alert.alert('Delete this draft?', 'Only this unpublished draft will be removed. Published documents are never deleted.', [
      { text: 'Keep draft', style: 'cancel' },
      {
        text: 'Delete draft',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void deleteLegalDraft(selected.id).then(load).catch((deleteError: unknown) => {
            setError(friendlyErrorMessage(deleteError, 'admin'));
          }).finally(() => setSaving(false));
        },
      },
    ]);
  };

  const publish = async () => {
    if (!selected || selected.status !== 'draft' || !superAdmin || saving) return;
    setSaving(true);
    setError('');
    try {
      if (dirty) await saveLegalDraft(selected.id, title, body);
      await publishLegalDraft(selected.id, changeSummary, effectiveDate);
      setPublishOpen(false);
      setDirty(false);
      setChangeSummary('');
      await load();
    } catch (publishError) {
      setError(friendlyErrorMessage(publishError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title="Legal documents" subtitle={superAdmin ? 'Draft and publish policies' : 'Read-only access'}>
      {loading && documents.length === 0 ? <AdminLoading rows={4} /> : error && documents.length === 0 ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.types}>
            {(['privacy', 'terms'] as const).map((type) => (
              <Button key={type} label={type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'} variant="outline" onPress={() => {
                const match = documents.find((document) => document.doc_type === type && document.status === 'draft')
                  ?? documents.find((document) => document.doc_type === type && document.status === 'published');
                if (match) selectDocument(match);
              }} />
            ))}
          </View>
          {superAdmin ? (
            <View style={styles.types}>
              <Button label="Create privacy draft" variant="outline" onPress={() => void create('privacy')} loading={saving} />
              <Button label="Create terms draft" variant="outline" onPress={() => void create('terms')} loading={saving} />
            </View>
          ) : null}
          {selected ? (
            <AdminCard>
              <View style={styles.heading}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{selected.title}</Text>
                  <Text style={styles.muted}>Version {selected.version}</Text>
                </View>
                <AdminStatusBadge label={selected.status} tone={selected.status === 'published' ? 'success' : 'neutral'} />
              </View>
              {selected.status === 'published' ? (
                <Text style={styles.muted}>
                  Acceptance: {acceptedCount ?? '—'} of {totalUsers ?? '—'} users
                </Text>
              ) : null}
              {selected.status === 'draft' && superAdmin ? (
                <>
                  <Field label="Document title" value={title} onChangeText={(value) => { setTitle(value); setDirty(true); }} onBlur={() => void save()} editable={!saving} />
                  <View style={styles.switchRow}>
                    <Text style={styles.muted}>{preview ? 'Preview' : 'Markdown body'}</Text>
                    <Pressable onPress={() => setPreview((value) => !value)} style={styles.switchButton} accessibilityRole="button">
                      <Text style={styles.link}>{preview ? 'Edit' : 'Preview'}</Text>
                    </Pressable>
                  </View>
                  {preview ? (
                    <MarkdownView>{body}</MarkdownView>
                  ) : (
                    <TextInput
                      value={body}
                      onChangeText={(value) => { setBody(value); setDirty(true); }}
                      onBlur={() => void save()}
                      multiline
                      textAlignVertical="top"
                      editable={!saving}
                      style={styles.bodyInput}
                      accessibilityLabel="Legal document Markdown body"
                    />
                  )}
                  <Button label={dirty ? 'Save draft' : 'Draft saved'} variant="outline" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />
                  <Button label="Publish" onPress={() => setPublishOpen(true)} disabled={saving || !title.trim() || !body.trim()} />
                  <Button label="Delete draft" variant="outline" onPress={removeDraft} disabled={saving} />
                </>
              ) : (
                <MarkdownView>{selected.body_md}</MarkdownView>
              )}
            </AdminCard>
          ) : (
            <Text style={styles.muted}>No legal documents are available.</Text>
          )}
          <AdminCard>
            <Text style={styles.sectionTitle}>Version history</Text>
            {documents.length === 0 ? <Text style={styles.muted}>No versions yet.</Text> : documents.map((document) => (
              <Pressable key={document.id} onPress={() => selectDocument(document)} style={styles.historyRow} accessibilityRole="button">
                <View style={styles.flex}>
                  <Text style={styles.historyTitle}>{document.doc_type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'} · v{document.version}</Text>
                  <Text style={styles.muted}>{document.change_summary || 'No change summary'}</Text>
                </View>
                <AdminStatusBadge label={document.status} tone={document.status === 'published' ? 'success' : 'neutral'} />
              </Pressable>
            ))}
          </AdminCard>
        </ScrollView>
      )}
      <Modal visible={publishOpen} transparent animationType="fade" onRequestClose={() => setPublishOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.modal}>
            <Text style={styles.sectionTitle}>Publish this document?</Text>
            <Text style={styles.muted}>It will be visible to everyone. Users must accept the new version before continuing.</Text>
            <Field label="What changed?" value={changeSummary} onChangeText={setChangeSummary} multiline editable={!saving} />
            <Field label="Effective date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} editable={!saving} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Publish document" onPress={() => void publish()} loading={saving} disabled={saving || changeSummary.trim().length < 3} />
            <Button label="Cancel" variant="outline" onPress={() => setPublishOpen(false)} disabled={saving} />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  flex: { flex: 1, minWidth: 0 },
  title: { color: colors.text, ...typography.heading },
  muted: { color: colors.textSecondary, ...typography.caption },
  sectionTitle: { color: colors.text, ...typography.heading },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two },
  link: { color: colors.primaryDark, ...typography.label },
  bodyInput: { minHeight: 240, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: Spacing.three, color: colors.text, ...typography.body },
  historyRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, borderTopWidth: 1, borderTopColor: colors.border },
  historyTitle: { color: colors.text, ...typography.label },
  error: { color: colors.danger, ...typography.caption },
  scrim: { flex: 1, justifyContent: 'center', padding: Spacing.five, backgroundColor: 'rgba(0,0,0,0.42)' },
  modal: { padding: Spacing.four, borderRadius: radius.lg, backgroundColor: colors.background, gap: Spacing.three },
});
