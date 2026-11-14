import AsyncStorage from '@react-native-async-storage/async-storage';

import { friendlyErrorMessage } from '@/lib/errors';
import { newId } from '@/lib/uuid';
import { supabase } from '@/lib/supabase';

export type SupportAccessSession = {
  id: string;
  businessId: string;
  businessName: string;
  expiresAt: number;
  write: boolean;
};

const sessionKey = '@mishop/admin/support-access';
const durations = [15, 30, 60, 120];

export const supportDataTables = [
  'products',
  'customers',
  'expenses',
  'categories',
  'expense_categories',
  'sales',
  'sale_items',
  'sale_payments',
  'stock_movements',
  'customer_ledger',
] as const;
export type SupportDataTable = typeof supportDataTables[number];
export type SupportDataRow = Record<string, unknown> & { id: string };
export const supportEditableFields = {
  products: ['category_id', 'name', 'sku', 'barcode', 'cost_price_minor', 'selling_price_minor', 'low_stock_threshold'],
  customers: ['name', 'phone', 'address', 'notes'],
  categories: ['name'],
  expense_categories: ['name'],
} as const;
type EditableTable = keyof typeof supportEditableFields;
const softDeletableTables: SupportDataTable[] = ['products', 'categories'];

export function isSupportEditableTable(table: SupportDataTable): table is EditableTable {
  return Object.prototype.hasOwnProperty.call(supportEditableFields, table);
}

export function getSupportEditableFields(table: SupportDataTable): readonly string[] {
  return isSupportEditableTable(table) ? supportEditableFields[table] : [];
}

function report(operation: string, error: unknown): Error {
  console.warn(`${operation} failed:`, error);
  return new Error(friendlyErrorMessage(error, 'admin'));
}

export async function startSupportAccess(input: {
  businessId: string;
  businessName: string;
  reason: string;
  minutes: number;
  write: boolean;
}): Promise<SupportAccessSession> {
  if (input.reason.trim().length < 10) throw new Error('Please give a reason of at least 10 characters.');
  if (!durations.includes(input.minutes)) throw new Error('Choose a support duration from the list.');
  const { data, error } = await supabase.rpc('admin_start_support_access', {
    p_business_id: input.businessId,
    p_reason: input.reason.trim(),
    p_minutes: input.minutes,
    p_write: input.write,
  });
  if (error) throw report('Starting support access', error);
  const id = typeof data === 'string' ? data : '';
  if (!id) throw new Error('The server did not return a support session id.');
  const session: SupportAccessSession = {
    id,
    businessId: input.businessId,
    businessName: input.businessName,
    expiresAt: Date.now() + input.minutes * 60_000,
    write: input.write,
  };
  await AsyncStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export async function getSavedSupportAccess(): Promise<SupportAccessSession | null> {
  const value = await AsyncStorage.getItem(sessionKey);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid support session.');
    const row = parsed as Record<string, unknown>;
    if (
      typeof row.id !== 'string'
      || typeof row.businessId !== 'string'
      || typeof row.businessName !== 'string'
      || typeof row.expiresAt !== 'number'
      || typeof row.write !== 'boolean'
    ) throw new Error('Invalid support session.');
    return {
      id: row.id,
      businessId: row.businessId,
      businessName: row.businessName,
      expiresAt: row.expiresAt,
      write: row.write,
    };
  } catch (error) {
    console.warn('Saved support session could not be read:', error);
    await AsyncStorage.removeItem(sessionKey);
    return null;
  }
}

export async function endSupportAccess(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_end_support_access', { p_session_id: sessionId });
  if (error) throw report('Ending support access', error);
  const saved = await getSavedSupportAccess();
  if (saved?.id === sessionId) await AsyncStorage.removeItem(sessionKey);
}

export async function clearSavedSupportAccess(): Promise<void> {
  await AsyncStorage.removeItem(sessionKey);
}

async function assertSupportAccess(sessionId: string, businessId: string, write = false): Promise<SupportAccessSession> {
  const session = await getSavedSupportAccess();
  if (!session || session.id !== sessionId || session.businessId !== businessId || session.expiresAt <= Date.now()) {
    throw new Error('Your support access has expired.');
  }
  if (write && !session.write) throw new Error('This support session is read-only.');
  return session;
}

function searchFieldFor(table: SupportDataTable): string | null {
  if (table === 'products' || table === 'categories' || table === 'customers' || table === 'expense_categories') return 'name';
  if (table === 'expenses') return 'description';
  if (table === 'sales') return 'receipt_no';
  if (table === 'sale_items') return 'product_name';
  if (table === 'sale_payments') return 'reference';
  if (table === 'stock_movements') return 'reason';
  if (table === 'customer_ledger') return 'note';
  return null;
}

function sanitizeEditableValues(table: EditableTable, input: Record<string, unknown>): Record<string, unknown> {
  const allowed = supportEditableFields[table] as readonly string[];
  const unexpected = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error('This field cannot be edited in support access.');
  const values = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
  if (Object.keys(values).length === 0) throw new Error('Enter at least one editable field.');

  const textFields = table === 'products'
    ? ['name', 'sku', 'barcode']
    : table === 'customers'
      ? ['name', 'phone', 'address', 'notes']
      : ['name'];
  for (const field of textFields) {
    if (!(field in values)) continue;
    const value = values[field];
    if (value !== null && typeof value !== 'string') throw new Error(`Enter valid ${field.replace(/_/g, ' ')} text.`);
    if (typeof value === 'string' && value.length > (field === 'notes' || field === 'address' ? 1000 : 160)) {
      throw new Error(`${field.replace(/_/g, ' ')} is too long.`);
    }
    if (field === 'name' && typeof value === 'string' && !value.trim()) throw new Error('Name cannot be empty.');
  }
  if (table === 'products') {
    if ('category_id' in values && values.category_id !== null && typeof values.category_id !== 'string') {
      throw new Error('Choose a valid product category.');
    }
    for (const field of ['cost_price_minor', 'selling_price_minor', 'low_stock_threshold']) {
      if (field in values && (!Number.isSafeInteger(values[field]) || Number(values[field]) < 0)) {
        throw new Error(`Enter a valid ${field.replace(/_/g, ' ')}.`);
      }
    }
  }
  return values;
}

export async function listSupportBusinessData(input: {
  sessionId: string;
  businessId: string;
  table: SupportDataTable;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<SupportDataRow[]> {
  await assertSupportAccess(input.sessionId, input.businessId);
  const limit = Math.min(30, Math.max(1, input.limit ?? 30));
  const offset = Math.max(0, input.offset ?? 0);
  let query = supabase.from(input.table).select('*');
  if (input.table === 'sale_items') {
    query = supabase.from('sale_items').select('*, sale:sales!inner(business_id)').eq('sale.business_id', input.businessId);
  } else if (input.table === 'sale_payments') {
    query = supabase.from('sale_payments').select('*, sale:sales!inner(business_id)').eq('sale.business_id', input.businessId);
  } else {
    query = query.eq('business_id', input.businessId);
  }
  query = query.order('id', { ascending: true }).range(offset, offset + limit - 1);
  const search = input.search?.trim();
  const searchField = searchFieldFor(input.table);
  if (search && searchField) query = query.ilike(searchField, `%${search.replace(/[%_,]/g, ' ')}%`);
  const { data, error } = await query;
  if (error) throw report(`Reading support ${input.table}`, error);
  return (data ?? []).filter((row): row is SupportDataRow => typeof row.id === 'string');
}

export async function createSupportBusinessRecord(input: {
  sessionId: string;
  businessId: string;
  table: SupportDataTable;
  values: Record<string, unknown>;
}): Promise<void> {
  await assertSupportAccess(input.sessionId, input.businessId, true);
  if (!isSupportEditableTable(input.table)) throw new Error('This business data is read-only.');
  const table = input.table;
  const values = sanitizeEditableValues(table, input.values);
  if (table === 'products') {
    for (const required of ['name', 'cost_price_minor', 'selling_price_minor', 'low_stock_threshold']) {
      if (!(required in values)) throw new Error(`Enter ${required.replace(/_/g, ' ')}.`);
    }
  } else if (!('name' in values)) {
    throw new Error('Enter a name.');
  }
  if (table === 'products' && typeof values.category_id === 'string') {
    const { data, error } = await supabase.from('categories').select('id')
      .eq('id', values.category_id).eq('business_id', input.businessId).is('deleted_at', null).maybeSingle();
    if (error) throw report('Checking support product category', error);
    if (!data) throw new Error('Choose a category from this business.');
  }
  Object.assign(values, { id: newId(), business_id: input.businessId });
  const { error } = await supabase.from(input.table).insert(values);
  if (error) throw report(`Creating support ${input.table} record`, error);
}

export async function updateSupportBusinessRecord(input: {
  sessionId: string;
  businessId: string;
  table: SupportDataTable;
  id: string;
  values: Record<string, unknown>;
}): Promise<void> {
  await assertSupportAccess(input.sessionId, input.businessId, true);
  if (!isSupportEditableTable(input.table)) throw new Error('This business data is read-only.');
  const table = input.table;
  const values = sanitizeEditableValues(table, input.values);
  if (table === 'products' && typeof values.category_id === 'string') {
    const { data, error } = await supabase.from('categories').select('id')
      .eq('id', values.category_id).eq('business_id', input.businessId).is('deleted_at', null).maybeSingle();
    if (error) throw report('Checking support product category', error);
    if (!data) throw new Error('Choose a category from this business.');
  }
  const { error } = await supabase.from(input.table)
    .update(values)
    .eq('id', input.id)
    .eq('business_id', input.businessId);
  if (error) throw report(`Updating support ${input.table} record`, error);
}

export async function deleteSupportBusinessRecord(input: {
  sessionId: string;
  businessId: string;
  table: SupportDataTable;
  id: string;
}): Promise<void> {
  await assertSupportAccess(input.sessionId, input.businessId, true);
  if (!softDeletableTables.includes(input.table)) throw new Error('This record cannot be deleted in support access.');
  if (input.table === 'categories') {
    const { count, error: countError } = await supabase.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', input.businessId)
      .eq('category_id', input.id)
      .is('deleted_at', null);
    if (countError) throw report('Checking support category usage', countError);
    if ((count ?? 0) > 0) throw new Error('Move the category’s products before removing it.');
  }
  const { error } = await supabase.from(input.table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('business_id', input.businessId);
  if (error) throw report(`Deleting support ${input.table} record`, error);
}
