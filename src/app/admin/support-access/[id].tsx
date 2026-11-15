import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';

import { AdminCard, AdminEmpty, AdminError, AdminLoading, AdminScreen, AdminStatusBadge } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  adjustSupportProductStock,
  createSupportBusinessRecord,
  deleteSupportBusinessRecord,
  endSupportAccess,
  getSupportEditableFields,
  getSavedSupportAccess,
  isSupportEditableTable,
  listSupportBusinessData,
  updateSupportBusinessRecord,
  type SupportAccessSession,
  type SupportDataRow,
  type SupportDataTable,
} from '@/services/supportAccessService';

type DataTab = 'products' | 'customers' | 'expenses' | 'categories' | 'sales' | 'sale_payments' | 'stock_movements' | 'customer_ledger';
type EditorValues = Record<string, string>;

const editableTabs: DataTab[] = ['products', 'customers', 'expenses', 'categories'];
const readOnlyTabs: DataTab[] = ['sales', 'sale_payments', 'stock_movements', 'customer_ledger'];
const tabLabels: Record<DataTab, string> = {
  products: 'Products',
  customers: 'Customers',
  expenses: 'Expenses',
  categories: 'Categories',
  sales: 'Sales',
  sale_payments: 'Payments',
  stock_movements: 'Stock moves',
  customer_ledger: 'Ledger',
};

const editableFields: Record<'products' | 'customers' | 'expenses' | 'categories' | 'expense_categories', readonly string[]> = {
  products: getSupportEditableFields('products'),
  customers: getSupportEditableFields('customers'),
  expenses: getSupportEditableFields('expenses'),
  categories: getSupportEditableFields('categories'),
  expense_categories: getSupportEditableFields('expense_categories'),
};

function isEditableTab(tab: DataTab): tab is 'products' | 'customers' | 'expenses' | 'categories' {
  return editableTabs.includes(tab);
}

function rowTitle(row: SupportDataRow): string {
  return String(row.name ?? row.full_name ?? row.product_name ?? row.receipt_no ?? row.description ?? row.id);
}

function rowDetails(row: SupportDataRow, table: DataTab): string {
  if (table === 'products') {
    return `SKU ${String(row.sku || '—')} · Qty ${String(row.quantity ?? '—')} · Price ${String(row.selling_price_minor ?? '—')}`;
  }
  if (table === 'customers') return `${String(row.phone || 'No phone')} · ${String(row.address || 'No address')}`;
  if (table === 'expenses') {
    return `${String(row.expense_date || '')} · ${String(row.amount_minor ?? '')} · ${String(row.payment_method || '')}`;
  }
  if (table === 'categories') return `Category · ${String(row.id)}`;
  if (table === 'sales') return `Receipt ${String(row.receipt_no || row.id)} · ${String(row.created_at || '')}`;
  if (table === 'sale_payments') return `${String(row.method || row.payment_method || '')} · ${String(row.amount_minor ?? '')}`;
  if (table === 'stock_movements') return `${String(row.type || row.movement_type || '')} · ${String(row.quantity_change ?? '')} · ${String(row.created_at || '')}`;
  return `${String(row.entry_type || '')} · ${String(row.amount_minor ?? '')} · ${String(row.created_at || '')}`;
}

function initialEditorValues(table: DataTab, row: SupportDataRow | null): EditorValues {
  if (!isEditableTab(table)) return {};
  const keys = table === 'categories' ? editableFields.categories : editableFields[table];
  return Object.fromEntries(keys.map((key) => [key, String(row?.[key] ?? '')]));
}

function valuesForSave(table: DataTab, input: EditorValues): Record<string, unknown> {
  if (!isEditableTab(table)) throw new Error('This record is read-only.');
  const allowed = editableFields[table];
  const values: Record<string, unknown> = {};
  for (const key of allowed) {
    const raw = input[key]?.trim() ?? '';
    if (['cost_price_minor', 'selling_price_minor', 'low_stock_threshold', 'amount_minor'].includes(key)) {
      if (raw === '' && (table === 'products' && key === 'low_stock_threshold')) continue;
      const number = Number(raw);
      if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Enter a valid ${key.replace(/_/g, ' ')}.`);
      values[key] = number;
    } else {
      values[key] = raw || (key === 'category_id' || key === 'sku' || key === 'barcode' || key === 'phone' || key === 'address' || key === 'notes' || key === 'description' ? null : '');
    }
  }
  return values;
}

export default function SupportBusinessDataScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const [session, setSession] = useState<SupportAccessSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [table, setTable] = useState<DataTab>('products');
  const [rows, setRows] = useState<SupportDataRow[]>([]);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorValues, setEditorValues] = useState<EditorValues>({});
  const [editing, setEditing] = useState<SupportDataRow | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<SupportDataRow[]>([]);
  const [categories, setCategories] = useState<SupportDataRow[]>([]);
  const [stockProduct, setStockProduct] = useState<SupportDataRow | null>(null);
  const [stockType, setStockType] = useState<'stock_in' | 'stock_out'>('stock_in');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockVisible, setStockVisible] = useState(false);
  const canWrite = Boolean(session?.write && isSupportEditableTable(table));
  const categoryChoices = useMemo(() => table === 'products' ? categories : expenseCategories, [categories, expenseCategories, table]);

  const loadSession = useCallback(async () => {
    const saved = await getSavedSupportAccess();
    if (!saved || saved.id !== sessionId || saved.businessId !== id || saved.expiresAt <= Date.now()) {
      setSession(null);
      setError('Support access has expired. Any unsaved changes were discarded.');
      setEditorVisible(false);
      setStockVisible(false);
      setEditorValues({});
      setEditing(null);
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
      const [data, categoryRows, expenseCategoryRows] = await Promise.all([
        listSupportBusinessData({
          sessionId: current.id,
          businessId: current.businessId,
          table,
          search,
          limit: 30,
          offset,
        }),
        listSupportBusinessData({
          sessionId: current.id,
          businessId: current.businessId,
          table: 'categories',
          limit: 30,
          offset: 0,
        }),
        listSupportBusinessData({
          sessionId: current.id,
          businessId: current.businessId,
          table: 'expense_categories',
          limit: 30,
          offset: 0,
        }),
      ]);
      setRows(data);
      setHasNext(data.length === 30);
      setCategories(categoryRows);
      setExpenseCategories(expenseCategoryRows);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, [loadSession, offset, search, table]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.expiresAt > now) return;
    setSession(null);
    setRows([]);
    setEditorVisible(false);
    setStockVisible(false);
    setEditorValues({});
    setEditing(null);
    setError('Support access has expired. Any unsaved changes were discarded.');
    Alert.alert('Support access expired', 'Your session ended. Any unsaved changes were discarded.');
  }, [now, session]);

  const changeTab = (next: DataTab) => {
    if (next === table) return;
    setTable(next);
    setOffset(0);
    setNotice('');
    setError('');
  };

  const closeSession = () => {
    if (!session || saving) return;
    const end = async () => {
      setSaving(true);
      setError('');
      try {
        await endSupportAccess(session.id);
        setSession(null);
        setRows([]);
        setEditorVisible(false);
        setStockVisible(false);
        setEditorValues({});
        setEditing(null);
        router.replace('/admin/support-access');
      } catch (closeError) {
        setError(friendlyErrorMessage(closeError, 'admin'));
      } finally {
        setSaving(false);
      }
    };
    if (editorVisible || stockVisible) {
      Alert.alert('Discard unsaved changes?', 'Ending support access will discard your current edits.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'End and discard', style: 'destructive', onPress: () => void end() },
      ]);
    } else {
      void end();
    }
  };

  const openEditor = (row: SupportDataRow | null) => {
    setEditing(row);
    setEditorValues(initialEditorValues(table, row));
    setError('');
    setEditorVisible(true);
  };

  const save = async () => {
    if (!session || !canWrite || !isEditableTab(table) || saving) return;
    setSaving(true);
    setError('');
    try {
      const values = valuesForSave(table, editorValues);
      const input = {
        sessionId: session.id,
        businessId: session.businessId,
        table: table as SupportDataTable,
        values,
      };
      if (editing) {
        await updateSupportBusinessRecord({ ...input, id: editing.id });
      } else {
        await createSupportBusinessRecord(input);
      }
      const savedName = String(values.name ?? values.description ?? tabLabels[table]);
      setNotice(`${editing ? 'Updated' : 'Added'} ${savedName}.`);
      setEditorVisible(false);
      setEditing(null);
      setEditorValues({});
      await load();
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: SupportDataRow) => {
    if (!session || !canWrite || saving) return;
    const name = rowTitle(row);
    Alert.alert(`Delete ${name}?`, `This will remove ${name} from this shop. This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          setError('');
          void deleteSupportBusinessRecord({
            sessionId: session.id,
            businessId: session.businessId,
            table,
            id: row.id,
          }).then(async () => {
            setNotice(`Deleted ${name}.`);
            await load();
          }).catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError, 'admin')))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  const openStockEditor = (row: SupportDataRow, type: 'stock_in' | 'stock_out') => {
    setStockProduct(row);
    setStockType(type);
    setStockQuantity('');
    setStockReason('');
    setError('');
    setStockVisible(true);
  };

  const saveStock = async () => {
    if (!session || !stockProduct || saving) return;
    const quantity = Number(stockQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setError('Enter a positive whole-number quantity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const newQuantity = await adjustSupportProductStock({
        sessionId: session.id,
        businessId: session.businessId,
        productId: stockProduct.id,
        type: stockType,
        quantity,
        reason: stockReason,
      });
      setNotice(`${stockType === 'stock_in' ? 'Added' : 'Removed'} ${quantity} units for ${rowTitle(stockProduct)}. New quantity: ${newQuantity}.`);
      setStockVisible(false);
      setStockProduct(null);
      await load();
    } catch (stockError) {
      setError(friendlyErrorMessage(stockError, 'admin'));
    } finally {
      setSaving(false);
    }
  };

  const remaining = Math.max(0, session ? session.expiresAt - now : 0);
  const timer = `${String(Math.floor(remaining / 60_000)).padStart(2, '0')}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')}`;
  const selectedTabReadOnly = readOnlyTabs.includes(table);
  return (
    <AdminScreen title="Data manager" subtitle={session?.businessName ?? 'Support access session'}>
      {!session && !loading ? (
        <AdminError message={error || 'Support access is unavailable.'} onRetry={() => void load()} />
      ) : (
        <>
          {session ? (
            <View style={[styles.sessionBar, session.write ? styles.writeBanner : styles.readBanner]}>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>{session.businessCode ? `${session.businessCode} · ` : ''}{session.businessName}</Text>
                <Text style={styles.sessionDetails}>
                  {session.write ? 'Changes allowed' : 'Read only'} · {timer} remaining
                </Text>
              </View>
              <Button label="End now" variant="outline" onPress={closeSession} loading={saving} disabled={saving} />
            </View>
          ) : undefined}
          <View style={styles.statusRow}>
            <AdminStatusBadge
              label={session?.write ? 'Changes allowed' : 'Read only'}
              tone={session?.write ? 'warning' : 'neutral'}
            />
            {session?.businessCode ? <Text style={styles.code}>{session.businessCode}</Text> : null}
          </View>
          <Text style={styles.groupTitle}>Editable shop data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {editableTabs.map((item) => (
              <TabButton key={item} item={item} selected={table === item} onPress={() => changeTab(item)} />
            ))}
          </ScrollView>
          <Text style={styles.groupTitle}>Financial records · always read-only</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {readOnlyTabs.map((item) => (
              <TabButton key={item} item={item} selected={table === item} onPress={() => changeTab(item)} />
            ))}
          </ScrollView>
          <View style={styles.search}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setOffset(0);
              }}
              placeholder={`Search ${tabLabels[table].toLowerCase()}`}
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel={`Search ${tabLabels[table].toLowerCase()}`}
            />
          </View>
          {selectedTabReadOnly ? (
            <AdminCard style={styles.readOnlyNote}>
              <Text style={styles.noteTitle}>Financial records cannot be edited</Text>
              <Text style={styles.readOnly}>Sales, payments, stock movements and customer ledger entries are permanently read-only.</Text>
            </AdminCard>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {canWrite && isEditableTab(table) ? (
            <Button label={`Add ${tabLabels[table].toLowerCase()}`} variant="outline" onPress={() => openEditor(null)} disabled={saving} />
          ) : null}
          {loading && rows.length === 0 ? <AdminLoading rows={4} /> : error && rows.length === 0 ? (
            <AdminError message={error} onRetry={() => void load()} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={() => <AdminEmpty message={`No ${tabLabels[table].toLowerCase()} found.`} />}
              renderItem={({ item }) => {
                const title = rowTitle(item);
                return (
                  <View style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.rowDetails} numberOfLines={2}>{rowDetails(item, table)}</Text>
                    </View>
                    {canWrite && isEditableTab(table) ? (
                      <View style={styles.rowActions}>
                        {table === 'products' ? (
                          <>
                            <ActionButton label={`Stock in ${title}`} text="Stock in" onPress={() => openStockEditor(item, 'stock_in')} disabled={saving} />
                            <ActionButton label={`Stock out ${title}`} text="Stock out" onPress={() => openStockEditor(item, 'stock_out')} disabled={saving} />
                          </>
                        ) : null}
                        <ActionButton label={`Edit ${title}`} text="Edit" onPress={() => openEditor(item)} disabled={saving} />
                        <ActionButton label={`Delete ${title}`} text="Delete" onPress={() => remove(item)} disabled={saving} destructive />
                      </View>
                    ) : (
                      <AdminStatusBadge label="Read only" tone="neutral" />
                    )}
                  </View>
                );
              }}
              ListFooterComponent={rows.length > 0 ? (
                <View style={styles.pagination}>
                  <Button label="Previous" variant="outline" onPress={() => setOffset((value) => Math.max(0, value - 30))} disabled={offset === 0 || loading} />
                  <Text style={styles.pageText}>Page {Math.floor(offset / 30) + 1}</Text>
                  <Button label="Next" variant="outline" onPress={() => setOffset((value) => value + 30)} disabled={!hasNext || loading} />
                </View>
              ) : undefined}
            />
          )}
        </>
      )}
      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => { if (!saving) setEditorVisible(false); }}>
        <View style={styles.modalScrim}>
          <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled">
            <Text style={styles.editorTitle}>{editing ? `Edit ${tabLabels[table].toLowerCase()}` : `Add ${tabLabels[table].toLowerCase()}`}</Text>
            <Text style={styles.readOnly}>Changes are saved to {session?.businessName}. Products start with zero stock; use Stock in or Stock out to change quantity.</Text>
            {isEditableTab(table) ? editableFields[table].map((field) => {
              if (field === 'category_id') {
                const choices = categoryChoices.filter((category) => typeof category.name === 'string');
                return (
                  <View key={field} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{table === 'products' ? 'Product category' : 'Expense category'}</Text>
                    {choices.map((choice) => (
                      <Pressable
                        key={choice.id}
                        onPress={() => setEditorValues((current) => ({ ...current, category_id: choice.id }))}
                        style={[styles.choice, editorValues.category_id === choice.id && styles.choiceSelected]}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose category ${String(choice.name)}`}
                        accessibilityState={{ selected: editorValues.category_id === choice.id }}
                      >
                        <Text style={[styles.choiceText, editorValues.category_id === choice.id && styles.choiceSelectedText]}>{String(choice.name)}</Text>
                      </Pressable>
                    ))}
                    <TextInput
                      value={editorValues.category_id ?? ''}
                      onChangeText={(value) => setEditorValues((current) => ({ ...current, category_id: value }))}
                      placeholder="Or enter category ID"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      accessibilityLabel="Category ID"
                    />
                  </View>
                );
              }
              if (field === 'payment_method') {
                return (
                  <View key={field} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Payment method</Text>
                    {(['cash', 'orange_money', 'afrimoney', 'other'] as const).map((method) => (
                      <Pressable
                        key={method}
                        onPress={() => setEditorValues((current) => ({ ...current, payment_method: method }))}
                        style={[styles.choice, editorValues.payment_method === method && styles.choiceSelected]}
                        accessibilityRole="button"
                        accessibilityLabel={`Payment method ${method.replace('_', ' ')}`}
                        accessibilityState={{ selected: editorValues.payment_method === method }}
                      >
                        <Text style={[styles.choiceText, editorValues.payment_method === method && styles.choiceSelectedText]}>{method.replace('_', ' ')}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              }
              const label = field.replace(/_minor$/, '').replace(/_/g, ' ');
              const isNumeric = ['cost_price_minor', 'selling_price_minor', 'low_stock_threshold', 'amount_minor'].includes(field);
              const isLong = ['notes', 'address', 'description'].includes(field);
              return (
                <View key={field} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{label}{field.endsWith('_minor') ? ' (minor units)' : ''}</Text>
                  <TextInput
                    value={editorValues[field] ?? ''}
                    onChangeText={(value) => setEditorValues((current) => ({ ...current, [field]: value }))}
                    placeholder={label}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType={isNumeric ? 'number-pad' : field === 'expense_date' ? 'numbers-and-punctuation' : 'default'}
                    multiline={isLong}
                    editable={!saving}
                    textAlignVertical={isLong ? 'top' : 'auto'}
                    style={[styles.input, isLong && styles.multilineInput]}
                    accessibilityLabel={label}
                  />
                </View>
              );
            }) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={editing ? 'Save changes' : 'Add record'} onPress={() => void save()} loading={saving} disabled={saving} />
            <Button label="Cancel" variant="outline" onPress={() => setEditorVisible(false)} disabled={saving} />
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={stockVisible} transparent animationType="slide" onRequestClose={() => { if (!saving) setStockVisible(false); }}>
        <View style={styles.modalScrim}>
          <View style={styles.editor}>
            <Text style={styles.editorTitle}>{stockType === 'stock_in' ? 'Stock in' : 'Stock out'}</Text>
            <Text style={styles.readOnly}>{stockProduct ? `${rowTitle(stockProduct)} · Current quantity ${String(stockProduct.quantity ?? '—')}` : ''}</Text>
            <TextInput
              value={stockQuantity}
              onChangeText={(value) => setStockQuantity(value.replace(/\D/g, ''))}
              placeholder="Quantity"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel={`${stockType === 'stock_in' ? 'Stock in' : 'Stock out'} quantity`}
            />
            <TextInput
              value={stockReason}
              onChangeText={setStockReason}
              placeholder="Reason"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              accessibilityLabel="Reason for stock change"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Save stock change" onPress={() => void saveStock()} loading={saving} disabled={saving} />
            <Button label="Cancel" variant="outline" onPress={() => setStockVisible(false)} disabled={saving} />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

function TabButton({ item, selected, onPress }: { item: DataTab; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, selected && styles.selectedTab]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${tabLabels[item]}${readOnlyTabs.includes(item) ? ', read only' : ''}`}
    >
      <Text style={[styles.tabText, selected && styles.selectedTabText]}>{tabLabels[item]}</Text>
    </Pressable>
  );
}

function ActionButton({ label, text, onPress, disabled, destructive = false }: {
  label: string;
  text: string;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, destructive && styles.destructiveAction, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.actionText, destructive && styles.destructiveText]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sessionBar: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.three, borderRadius: radius.md },
  writeBanner: { backgroundColor: colors.danger },
  readBanner: { backgroundColor: '#FFF3DC' },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: colors.white, ...typography.label },
  sessionDetails: { color: colors.white, ...typography.caption },
  statusRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  code: { color: colors.textSecondary, ...typography.caption, flexShrink: 1 },
  groupTitle: { color: colors.text, ...typography.label, marginTop: Spacing.two },
  tabs: { gap: Spacing.two, paddingVertical: Spacing.one },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  selectedTab: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabText: { color: colors.textSecondary, ...typography.label },
  selectedTabText: { color: colors.primaryDark },
  search: { height: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, ...typography.body },
  readOnlyNote: { gap: Spacing.one, borderWidth: 1, borderColor: colors.border },
  noteTitle: { color: colors.text, ...typography.label },
  readOnly: { color: colors.textSecondary, ...typography.caption, lineHeight: 19 },
  notice: { color: colors.primaryDark, ...typography.caption, padding: Spacing.two, borderRadius: radius.sm, backgroundColor: colors.primaryLight },
  error: { color: colors.danger, ...typography.caption },
  list: { paddingBottom: Spacing.seven },
  row: { minHeight: 84, justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowCopy: { minWidth: 0, justifyContent: 'center', minHeight: 52 },
  rowTitle: { color: colors.text, ...typography.label },
  rowDetails: { color: colors.textSecondary, ...typography.caption },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  actionButton: { minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.two, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  actionText: { color: colors.primaryDark, ...typography.caption },
  destructiveAction: { borderColor: '#F3CACA' },
  destructiveText: { color: colors.danger },
  disabled: { opacity: 0.45 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.three },
  pageText: { color: colors.textSecondary, ...typography.caption },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  editor: { gap: Spacing.three, maxHeight: '90%', padding: Spacing.five, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  editorTitle: { color: colors.text, ...typography.heading },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { color: colors.text, ...typography.label },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.three, backgroundColor: colors.white, color: colors.text, ...typography.body },
  multilineInput: { minHeight: 92, paddingTop: Spacing.two },
  choice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceText: { color: colors.text, ...typography.body },
  choiceSelectedText: { color: colors.primaryDark, fontWeight: '700' },
});
