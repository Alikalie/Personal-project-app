import { friendlyErrorMessage } from '@/lib/errors';
import { newId } from '@/lib/uuid';
import { supabase } from '@/lib/supabase';

export type ExpensePaymentMethod = 'cash' | 'orange_money' | 'afrimoney' | 'other';

export type ExpenseCategory = {
  id: string;
  business_id: string;
  name: string;
};

export type Expense = {
  id: string;
  business_id: string;
  amount_minor: number;
  category_id: string;
  category_name: string;
  description: string | null;
  payment_method: ExpensePaymentMethod;
  expense_date: string;
  created_at: string;
};

function objectOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The server returned invalid expense data.');
  }
  return value as Record<string, unknown>;
}

function mapCategory(value: unknown): ExpenseCategory {
  const row = objectOf(value);
  if (typeof row.id !== 'string' || typeof row.business_id !== 'string' || typeof row.name !== 'string') {
    throw new Error('The server returned invalid expense category data.');
  }
  return { id: row.id, business_id: row.business_id, name: row.name };
}

function mapExpense(value: unknown): Expense {
  const row = objectOf(value);
  const amountMinor = typeof row.amount_minor === 'number' ? row.amount_minor : Number(row.amount_minor);
  const category = Array.isArray(row.category)
    ? objectOf(row.category[0])
    : typeof row.category === 'object' && row.category !== null
      ? objectOf(row.category)
      : {};
  const method = row.payment_method;
  if (
    typeof row.id !== 'string'
    || typeof row.business_id !== 'string'
    || !Number.isSafeInteger(amountMinor)
    || typeof row.category_id !== 'string'
    || typeof row.expense_date !== 'string'
    || !['cash', 'orange_money', 'afrimoney', 'other'].includes(String(method))
  ) {
    throw new Error('The server returned invalid expense data.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    amount_minor: amountMinor,
    category_id: row.category_id,
    category_name: typeof category.name === 'string' ? category.name : 'Expense',
    description: typeof row.description === 'string' ? row.description : null,
    payment_method: method as ExpensePaymentMethod,
    expense_date: row.expense_date,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

export async function listExpenseCategories(businessId: string): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase.from('expense_categories')
    .select('id, business_id, name')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  if (error) {
    console.warn('Expense categories query failed:', error);
    throw new Error(friendlyErrorMessage(error));
  }
  return (data ?? []).map(mapCategory);
}

export async function createExpenseCategory(businessId: string, name: string): Promise<ExpenseCategory> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter a category name.');
  const { data, error } = await supabase.from('expense_categories')
    .insert({ business_id: businessId, name: normalizedName })
    .select('id, business_id, name')
    .single();
  if (error) {
    console.warn('Expense category creation failed:', error);
    throw new Error(friendlyErrorMessage(error));
  }
  return mapCategory(data);
}

export async function listExpenses(businessId: string): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses')
    .select('id, business_id, amount_minor, category_id, description, payment_method, expense_date, created_at, category:expense_categories(name)')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('Expenses query failed:', error);
    throw new Error(friendlyErrorMessage(error));
  }
  return (data ?? []).map(mapExpense);
}

export async function createExpense(input: {
  businessId: string;
  userId: string;
  amountMinor: number;
  categoryId: string;
  description: string | null;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
}): Promise<Expense> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate) || Number.isNaN(Date.parse(`${input.expenseDate}T00:00:00Z`))) {
    throw new Error('Enter a valid expense date.');
  }
  const { data, error } = await supabase.from('expenses')
    .insert({
      id: newId(),
      business_id: input.businessId,
      amount_minor: input.amountMinor,
      category_id: input.categoryId,
      description: input.description?.trim() || null,
      payment_method: input.paymentMethod,
      expense_date: input.expenseDate,
      created_by: input.userId,
    })
    .select('id, business_id, amount_minor, category_id, description, payment_method, expense_date, created_at, category:expense_categories(name)')
    .single();
  if (error) {
    console.warn('Expense creation failed:', error);
    throw new Error(friendlyErrorMessage(error));
  }
  return mapExpense(data);
}
