import { friendlyErrorMessage } from '@/lib/errors';
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
