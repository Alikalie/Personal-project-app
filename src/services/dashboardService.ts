import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const businessTimezone = 'Africa/Freetown';

type DashboardData = {
  todaySales: number;
  grossProfit: number;
  totalProducts: number;
  lowStock: number;
  outstandingDebts: number;
  weekSales: { date: string; day: string; value: number; profit: number }[];
  recentTransactions: {
    id: string;
    receipt: string;
    customer: string;
    soldAt: string;
    total: number;
    credit: number;
  }[];
};

type DashboardRefreshListener = (businessId: string) => Promise<void>;
const dashboardRefreshListeners = new Set<DashboardRefreshListener>();

export function subscribeToDashboardRefresh(listener: DashboardRefreshListener): () => void {
  dashboardRefreshListeners.add(listener);
  return () => dashboardRefreshListeners.delete(listener);
}

export async function refreshDashboardViews(businessId: string): Promise<void> {
  if (dashboardRefreshListeners.size === 0) {
    await getDashboard(businessId);
    return;
  }
  await Promise.all([...dashboardRefreshListeners].map((listener) => listener(businessId)));
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(objectOf).filter((row): row is Record<string, unknown> => row !== null)
    : [];
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function minorUnits(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error('The server returned an invalid money amount.');
  }
  return parsed;
}

function dateInFreetown(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekday(date: string): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: businessTimezone,
    weekday: 'short',
  }).format(new Date(`${date}T12:00:00Z`));
}

function customerName(value: unknown): string {
  const joined = Array.isArray(value) ? objectOf(value[0]) : objectOf(value);
  const name = joined?.name;
  return typeof name === 'string' && name.trim() ? name : 'Customer';
}

export async function getDashboard(businessId: string, includeProfit = false): Promise<DashboardData> {
  const today = dateInFreetown(new Date());
  const firstDay = shiftDate(today, -6);
  const dailySelect = includeProfit
    ? 'sold_at, total_minor, gross_profit_minor'
    : 'sold_at, total_minor';
  const [dailyResult, productsResult, lowStockResult, balanceResult, salesResult] = await Promise.all([
    supabase.from('sales')
      .select(dailySelect)
      .eq('business_id', businessId)
      .gte('sold_at', `${firstDay}T00:00:00.000Z`)
      .lt('sold_at', `${shiftDate(today, 1)}T00:00:00.000Z`),
    supabase.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null),
    supabase.from('low_stock_products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId),
    supabase.from('customer_balances')
      .select('balance_minor')
      .eq('business_id', businessId)
      .gt('balance_minor', 0),
    supabase.from('sales')
      .select('receipt_no, total_minor, credit_minor, sold_at, customer:customers(name)')
      .eq('business_id', businessId)
      .order('sold_at', { ascending: false })
      .limit(5),
  ]);

  const failedResult = [dailyResult, productsResult, lowStockResult, balanceResult, salesResult]
    .find((result) => result.error);
  if (failedResult?.error) throw new Error(friendlyErrorMessage(failedResult.error));

  const salesByDate = new Map<string, { total: number; profit: number }>();
  for (const row of rowsOf(dailyResult.data)) {
    const soldAt = new Date(stringOf(row.sold_at));
    if (Number.isNaN(soldAt.getTime())) continue;
    const date = dateInFreetown(soldAt);
    const current = salesByDate.get(date) ?? { total: 0, profit: 0 };
    const total = current.total + minorUnits(row.total_minor);
    const profit = current.profit + (includeProfit ? minorUnits(row.gross_profit_minor) : 0);
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(profit)) {
      throw new Error('The server returned a daily sales total outside the supported range.');
    }
    salesByDate.set(date, { total, profit });
  }
  const weekSales = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(firstDay, index);
    const daily = salesByDate.get(date);
    return {
      date,
      day: weekday(date),
      value: daily?.total ?? 0,
      profit: daily?.profit ?? 0,
    };
  });
  const recentTransactions = rowsOf(salesResult.data).map((row, index) => {
    const receipt = stringOf(row.receipt_no);
    const soldAt = stringOf(row.sold_at);
    return {
      id: receipt || `${soldAt}-${index}`,
      receipt: receipt || 'Sale',
      customer: customerName(row.customer),
      soldAt,
      total: minorUnits(row.total_minor),
      credit: minorUnits(row.credit_minor),
    };
  });
  const outstandingDebts = rowsOf(balanceResult.data)
    .reduce((total, row) => total + minorUnits(row.balance_minor), 0);
  if (!Number.isSafeInteger(outstandingDebts)) {
    throw new Error('The server returned an invalid customer balance total.');
  }

  return {
    todaySales: salesByDate.get(today)?.total ?? 0,
    grossProfit: salesByDate.get(today)?.profit ?? 0,
    totalProducts: productsResult.count ?? 0,
    lowStock: lowStockResult.count ?? 0,
    outstandingDebts,
    weekSales,
    recentTransactions,
  };
}
