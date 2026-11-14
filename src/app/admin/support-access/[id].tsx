import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';

import { AdminEmpty, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  createSupportBusinessRecord,
  deleteSupportBusinessRecord,
  endSupportAccess,
  getSupportEditableFields,
  getSavedSupportAccess,
  isSupportEditableTable,
  listSupportBusinessData,
  supportDataTables,
  updateSupportBusinessRecord,
  type SupportAccessSession,
  type SupportDataRow,
  type SupportDataTable,
} from '@/services/supportAccessService';

const tableLabels: Record<SupportDataTable, string> = {
  products: 'Products',
  customers: 'Customers',
  expenses: 'Expenses',
  categories: 'Categories',
  expense_categories: 'Expense categories',
  sales: 'Sales',
  sale_items: 'Sale items',
  sale_payments: 'Payments',
  stock_movements: 'Stock movements',
  customer_ledger: 'Customer ledger',
};

export default function SupportBusinessDataScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const [session, setSession] = useState<SupportAccessSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [table, setTable] = useState<SupportDataTable>('products');
  const [rows, setRows] = useState<SupportDataRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorJson, setEditorJson] = useState('');
  const [editing, setEditing] = useState<SupportDataRow | null>(null);
  const canWrite = Boolean(session?.write && isSupportEditableTable(table));

  const loadSession = useCallback(async () => {
    const saved = await getSavedSupportAccess();
    if (!saved || saved.id !== sessionId || saved.businessId !== id || saved.expiresAt <= Date.now()) {
      setSession(null);
      setError('Your support access has expired. Return to Support access to open a new session.');
      return null;
    }
    setSession(saved);
    return saved;
  }, [id, sessionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = await loadSession();
      if (!current) return;
      setRows(await listSupportBusinessData({
        sessionId: current.id,
        businessId: current.businessId,
        table,
        search,
        limit: 30,
        offset: 0,
      }));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [loadSession, search, table]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (session && session.expiresAt <= now) {
      setSession(null);
      setRows([]);
      setError('Support access has expired. Return to Support access to open a new session.');
    }
  }, [now, session]);

  const closeSession = async () => {
    if (!session || saving) return;
    setSaving(true);
    setError('');
    try {
      await endSupportAccess(session.id);
      setSession(null);
      router.replace('/admin/support-access');
    } catch (closeError) {
      setError(friendlyErrorMessage(closeError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (row: SupportDataRow | null) => {
    setEditing(row);
    const values = row
      ? Object.fromEntries(getSupportEditableFields(table).map((field) => [field, row[field]]))
      : {};
    setEditorJson(JSON.stringify(values, null, 2));
    setEditorVisible(true);
  };

  const save = async () => {
    if (!session || !canWrite || saving) return;
    let values: unknown;
    try {
      values = JSON.parse(editorJson);
    } catch {
      setError('Enter valid JSON.');
      return;
    }
    if (typeof values !== 'object' || values === null || Array.isArray(values)) {
      setError('Enter a JSON object with the record fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = {
        sessionId: session.id,
        businessId: session.businessId,
        table,
        values: values as Record<string, unknown>,
      };
      if (editing) await updateSupportBusinessRecord({ ...input, id: editing.id });
      else await createSupportBusinessRecord(input);
      setEditorVisible(false);
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: SupportDataRow) => {
    if (!session || !canWrite || saving) return;
    Alert.alert('Delete this record?', 'The record will be removed or soft-deleted where supported.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void deleteSupportBusinessRecord({
            sessionId: session.id,
            businessId: session.businessId,
            table,
            id: row.id,
          }).then(load).catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError, 'admin')))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  return (
    <AdminScreen title={session?.businessName ?? 'Business data'} subtitle="Support access session">
      {!session && !loading ? (
        <AdminError message={error || 'Support access is unavailable.'} onRetry={() => void load()} />
      ) : (
        <>
          {session ? (
            <View style={styles.sessionBar}>
              <Text style={styles.readOnly}>
                {session.write ? 'Time-limited write access' : 'Read-only access'} · {Math.max(0, Math.ceil((session.expiresAt - now) / 60_000))} min left
              </Text>
              <Button label="End support access" variant="outline" onPress={() => void closeSession()} loading={saving} disabled={saving} />
            </View>
          ) : null}
          <View style={styles.tabs}>
            {supportDataTables.map((item) => (
              <Pressable key={item} onPress={() => setTable(item)} style={[styles.tab, table === item && styles.selectedTab]} accessibilityRole="button" accessibilityState={{ selected: table === item }}>
                <Text style={[styles.tabText, table === item && styles.selectedTabText]}>{tableLabels[item]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.search}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search this list" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" />
          </View>
          {!isSupportEditableTable(table) ? <Text style={styles.readOnly}>Financial records cannot be edited.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {canWrite ? <Button label={`Add ${tableLabels[table].toLowerCase()}`} variant="outline" onPress={() => openEditor(null)} /> : null}
          {loading && rows.length === 0 ? <AdminLoading rows={4} /> : error && rows.length === 0 ? (
            <AdminError message={error} onRetry={() => void load()} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={() => <AdminEmpty message={`No ${tableLabels[table].toLowerCase()} found.`} />}
              renderItem={({ item }) => {
                const title = String(item.name ?? item.full_name ?? item.product_name ?? item.receipt_no ?? item.id);
                const details = Object.entries(item)
                  .filter(([key]) => key !== 'id' && key !== 'business_id')
                  .slice(0, 3)
                  .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value ?? '—')}`)
                  .join(' · ');
                return (
                  <View style={styles.row}>
                    <Pressable onPress={() => canWrite && openEditor(item)} style={styles.rowCopy} accessibilityRole={canWrite ? 'button' : undefined}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.rowDetails} numberOfLines={2}>{details}</Text>
                    </Pressable>
                    {canWrite && (table === 'products' || table === 'categories')
                      ? <Pressable onPress={() => remove(item)} style={styles.deleteButton} accessibilityRole="button"><Text style={styles.deleteText}>Delete</Text></Pressable>
                      : <AdminStatusBadge label="Read-only" tone="neutral" />}
                  </View>
                );
              }}
            />
          )}
        </>
      )}
      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => { if (!saving) setEditorVisible(false); }}>
        <View style={styles.scrim}>
          <View style={styles.editor}>
            <Text style={styles.editorTitle}>{editing ? 'Edit record' : 'Add record'}</Text>
            <Text style={styles.readOnly}>Enter editable fields as a JSON object. The business and record IDs are managed by MiShop.</Text>
            <TextInput value={editorJson} onChangeText={setEditorJson} multiline editable={!saving} textAlignVertical="top" style={styles.jsonInput} accessibilityLabel="Record fields JSON" />
            <Button label={editing ? 'Save changes' : 'Create record'} onPress={() => void save()} loading={saving} disabled={saving} />
            <Button label="Cancel" variant="outline" onPress={() => setEditorVisible(false)} disabled={saving} />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  sessionBar: { gap: Spacing.two, padding: Spacing.three, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingVertical: Spacing.two },
  tab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.two, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  selectedTab: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabText: { color: colors.textSecondary, ...typography.caption },
  selectedTabText: { color: colors.primaryDark },
  search: { height: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, ...typography.body },
  readOnly: { color: colors.textSecondary, ...typography.caption },
  error: { color: colors.danger, ...typography.caption },
  list: { paddingBottom: Spacing.seven },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowCopy: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 72 },
  rowTitle: { color: colors.text, ...typography.label },
  rowDetails: { color: colors.textSecondary, ...typography.caption },
  deleteButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two },
  deleteText: { color: colors.danger, ...typography.caption },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  editor: { gap: Spacing.three, maxHeight: '85%', padding: Spacing.five, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  editorTitle: { color: colors.text, ...typography.heading },
  jsonInput: { minHeight: 240, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.three, color: colors.text, fontFamily: 'monospace' },
});
