import { friendlyErrorMessage } from '@/lib/errors';
import type { PaymentMethod } from '@/services/salesService';
import { supabase } from '@/lib/supabase';

export type Customer = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address?: string | null;
  notes?: string | null;
  balance_minor?: number;
};

export type CustomerLedgerEntry = {
  id: string;
  business_id: string;
  customer_id: string;
  entry_type: string;
  amount_minor: number;
  method: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  reverses_entry_id: string | null;
  corrects_entry_id: string | null;
};

export type RepaymentStatus = 'active' | 'corrected' | 'cancelled';

export type EditRepaymentInput = {
  entryId: string;
  newId: string;
  businessId: string;
  newAmountMinor: number;
  method: PaymentMethod;
  note: string | null;
  reason: string;
};

export type VoidRepaymentInput = {
  entryId: string;
  businessId: string;
  reason: string;
};

export type RecordRepaymentInput = {
  id: string;
  businessId: string;
  customerId: string;
  amountMinor: number;
  method: PaymentMethod;
  note: string | null;
};

function mapLedgerEntry(value: unknown): CustomerLedgerEntry {
  if (typeof value !== 'object' || value === null) throw new Error('The server returned an invalid ledger entry.');
  const row = value as Record<string, unknown>;
  const amountMinor = typeof row.amount_minor === 'number' ? row.amount_minor : Number(row.amount_minor);
  if (
    typeof row.id !== 'string'
    || typeof row.business_id !== 'string'
    || typeof row.customer_id !== 'string'
    || typeof row.entry_type !== 'string'
    || !Number.isSafeInteger(amountMinor)
    || typeof row.created_at !== 'string'
  ) {
    throw new Error('The server returned an invalid ledger entry.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    customer_id: row.customer_id,
    entry_type: row.entry_type,
    amount_minor: amountMinor,
    method: typeof row.method === 'string' ? row.method : null,
    note: typeof row.note === 'string' ? row.note : null,
    created_at: row.created_at,
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    created_by_name: null,
    reverses_entry_id: typeof row.reverses_entry_id === 'string' ? row.reverses_entry_id : null,
    corrects_entry_id: typeof row.corrects_entry_id === 'string' ? row.corrects_entry_id : null,
  };
}

export function getRepaymentStatus(
  entry: CustomerLedgerEntry,
  ledger: CustomerLedgerEntry[],
): RepaymentStatus {
  if (entry.entry_type !== 'repayment') return 'active';
  const reversal = ledger.find((row) => row.reverses_entry_id === entry.id);
  if (!reversal) return 'active';
  return ledger.some((row) => row.corrects_entry_id === entry.id) ? 'corrected' : 'cancelled';
}

function mapCustomer(value: unknown): Customer {
  if (typeof value !== 'object' || value === null) throw new Error('The server returned an invalid customer.');
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.business_id !== 'string' || typeof row.name !== 'string') {
    throw new Error('The server returned an invalid customer.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    phone: typeof row.phone === 'string' ? row.phone : null,
    address: typeof row.address === 'string' ? row.address : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    balance_minor: typeof row.balance_minor === 'number' ? row.balance_minor : undefined,
  };
}

export async function searchCustomers(businessId: string, search: string): Promise<Customer[]> {
  let query = supabase.from('customers')
    .select('id, business_id, name, phone, address, notes')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
    .limit(20);
  const term = search.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(friendlyErrorMessage(error));
  return attachBalances(businessId, (data ?? []).map(mapCustomer));
}

export async function listCustomers(businessId: string, search = ''): Promise<Customer[]> {
  return searchCustomers(businessId, search);
}

export async function getCustomer(businessId: string, customerId: string): Promise<Customer> {
  const { data, error } = await supabase.from('customers')
    .select('id, business_id, name, phone, address, notes')
    .eq('business_id', businessId)
    .eq('id', customerId)
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  const [customer] = await attachBalances(businessId, [mapCustomer(data)]);
  return customer;
}

export async function getCustomerLedger(businessId: string, customerId: string): Promise<CustomerLedgerEntry[]> {
  const pageSize = 1000;
  const entries: CustomerLedgerEntry[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('customer_ledger')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(friendlyErrorMessage(error));
    const page = (data ?? []).map(mapLedgerEntry);
    entries.push(...page);
    if (page.length < pageSize) break;
  }
  const creatorIds = [...new Set(entries.flatMap((entry) => entry.created_by ? [entry.created_by] : []))];
  if (creatorIds.length === 0) return entries;
  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select('id, full_name')
    .in('id', creatorIds);
  if (profilesError) throw new Error(friendlyErrorMessage(profilesError));
  const names = new Map((profiles ?? []).flatMap((profile) =>
    typeof profile.id === 'string' && typeof profile.full_name === 'string'
      ? [[profile.id, profile.full_name] as const]
      : [],
  ));
  return entries.map((entry) => ({
    ...entry,
    created_by_name: entry.created_by ? names.get(entry.created_by) ?? null : null,
  }));
}

export async function getCustomerLedgerEntry(
  businessId: string,
  entryId: string,
): Promise<CustomerLedgerEntry> {
  const { data, error } = await supabase.from('customer_ledger')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', entryId)
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapLedgerEntry(data);
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  const { data, error } = await supabase.from('customer_balances')
    .select('balance_minor')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(friendlyErrorMessage(error));
  const balanceMinor = data ? Number(data.balance_minor) : 0;
  if (!Number.isSafeInteger(balanceMinor)) {
    throw new Error('The server returned an invalid customer balance.');
  }
  return balanceMinor;
}

export async function recordRepayment(input: RecordRepaymentInput): Promise<number> {
  const amountMinor = Math.round(input.amountMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }
  try {
    const { data, error } = await supabase.rpc('record_repayment', {
      p_id: input.id,
      p_business_id: input.businessId,
      p_customer_id: input.customerId,
      p_amount_minor: amountMinor,
      p_method: input.method,
      p_note: input.note?.trim() || null,
    });
    if (error) throw error;
    const balanceMinor = typeof data === 'number'
      ? data
      : typeof data === 'string' && data.trim() !== ''
        ? Number(data)
        : Number.NaN;
    if (!Number.isSafeInteger(balanceMinor) || balanceMinor < 0) {
      throw new Error('The server returned an invalid customer balance.');
    }
    return balanceMinor;
  } catch (error) {
    let rawError = '[unserializable error]';
    try {
      rawError = JSON.stringify(error, error instanceof Error ? Object.getOwnPropertyNames(error) : undefined);
    } catch {
      rawError = String(error);
    }
    console.warn('record_repayment RPC failed:', rawError);
    throw error;
  }
}

export async function editRepayment(input: EditRepaymentInput): Promise<number> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error('Please give a reason.');
  if (!Number.isSafeInteger(input.newAmountMinor) || input.newAmountMinor <= 0) {
    throw new Error('Amount must be greater than zero.');
  }
  try {
    const { data, error } = await supabase.rpc('edit_repayment', {
      p_entry_id: input.entryId,
      p_new_id: input.newId,
      p_business_id: input.businessId,
      p_new_amount_minor: input.newAmountMinor,
      p_method: input.method,
      p_note: input.note?.trim() || null,
      p_reason: reason,
    });
    if (error) throw error;
    const balanceMinor = typeof data === 'number' ? data : Number(data);
    if (!Number.isSafeInteger(balanceMinor)) throw new Error('The server returned an invalid customer balance.');
    return balanceMinor;
  } catch (error) {
    console.warn('edit_repayment RPC failed:', error);
    throw new Error(friendlyErrorMessage(error, 'repayment'));
  }
}

export async function voidRepayment(input: VoidRepaymentInput): Promise<number> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error('Please give a reason.');
  try {
    const { data, error } = await supabase.rpc('void_repayment', {
      p_entry_id: input.entryId,
      p_business_id: input.businessId,
      p_reason: reason,
    });
    if (error) throw error;
    const balanceMinor = typeof data === 'number' ? data : Number(data);
    if (!Number.isSafeInteger(balanceMinor)) throw new Error('The server returned an invalid customer balance.');
    return balanceMinor;
  } catch (error) {
    console.warn('void_repayment RPC failed:', error);
    throw new Error(friendlyErrorMessage(error, 'repayment'));
  }
}

export async function getCustomerSummary(businessId: string): Promise<{ customerCount: number; totalOwedMinor: number }> {
  const [customersResult, balancesResult] = await Promise.all([
    supabase.from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId),
    supabase.from('customer_balances')
      .select('balance_minor')
      .eq('business_id', businessId)
      .gt('balance_minor', 0),
  ]);
  if (customersResult.error) throw new Error(friendlyErrorMessage(customersResult.error));
  if (balancesResult.error) throw new Error(friendlyErrorMessage(balancesResult.error));
  const totalOwedMinor = (balancesResult.data ?? []).reduce((total, row) => {
    const balance = Number(row.balance_minor);
    if (!Number.isSafeInteger(balance) || balance <= 0) {
      throw new Error('The server returned an invalid customer balance.');
    }
    const result = total + balance;
    if (!Number.isSafeInteger(result)) throw new Error('The customer balance total exceeds the supported range.');
    return result;
  }, 0);
  return { customerCount: customersResult.count ?? 0, totalOwedMinor };
}

async function attachBalances(businessId: string, customers: Customer[]): Promise<Customer[]> {
  if (customers.length === 0) return [];
  const ids = customers.map((customer) => customer.id);
  const { data, error } = await supabase.from('customer_balances')
    .select('customer_id, balance_minor')
    .eq('business_id', businessId)
    .in('customer_id', ids);
  if (error) throw new Error(friendlyErrorMessage(error));
  const balances = new Map((data ?? []).flatMap((row) => {
    if (typeof row.customer_id !== 'string') return [];
    const value = Number(row.balance_minor);
    if (!Number.isSafeInteger(value)) throw new Error('The server returned an invalid customer balance.');
    return [[row.customer_id, value] as const];
  }));
  return customers.map((customer) => ({ ...customer, balance_minor: balances.get(customer.id) ?? 0 }));
}

export async function createCustomer(
  businessId: string,
  name: string,
  phone?: string,
  address?: string,
  notes?: string,
): Promise<Customer> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter the customer’s name.');
  const { data, error } = await supabase.from('customers')
    .insert({
      business_id: businessId,
      name: normalizedName,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select('id, business_id, name, phone, address, notes')
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapCustomer(data);
}
