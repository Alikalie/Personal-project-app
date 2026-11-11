import type { CartItem } from '@/lib/cart';
import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/services/customerService';
import { getImageUrl, type Product } from '@/services/productService';

export type PaymentMethod = 'cash' | 'orange_money' | 'afrimoney' | 'other';
export type PaymentInput = {
  method: PaymentMethod;
  amountMinor: number;
  reference: string | null;
};
export type Sale = {
  id: string;
  business_id: string;
  customer_id: string | null;
  receipt_no: string;
  total_minor: number;
  discount_minor: number;
  credit_minor: number;
  gross_profit_minor: number | null;
  sold_at: string;
  cashier_id: string | null;
};
export type SaleItem = {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
};
export type SalePayment = {
  id: string;
  method: string;
  amount_minor: number;
  reference: string | null;
};
export type SaleRecord = {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
  customer: Customer | null;
  cashierName: string;
};
export type SaleReceiptData = SaleRecord & {
  business: {
    name: string;
    address: string | null;
    phone: string | null;
    receipt_header: string | null;
    receipt_footer: string | null;
    show_logo_on_receipt: boolean;
    logo_path: string | null;
    logo_url: string | null;
  };
};
export type SaleListRow = {
  sale: Sale;
  customerName: string;
  paymentMethods: string[];
};

type Raw = Record<string, unknown>;
const numberValue = (value: unknown, fallback = 0): number => {
  const result = typeof value === 'number' ? value : Number(value ?? fallback);
  if (!Number.isSafeInteger(result)) throw new Error('The server returned an invalid sale amount.');
  return result;
};
const textValue = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const relation = (value: unknown): Raw | null => Array.isArray(value)
  ? (typeof value[0] === 'object' && value[0] !== null ? value[0] as Raw : null)
  : (typeof value === 'object' && value !== null ? value as Raw : null);

function mapSale(value: unknown): Sale {
  const row = value as Raw;
  if (!row || typeof row.id !== 'string' || typeof row.business_id !== 'string') {
    throw new Error('The server returned an invalid sale.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    customer_id: typeof row.customer_id === 'string' ? row.customer_id : null,
    receipt_no: textValue(row.receipt_no),
    total_minor: numberValue(row.total_minor),
    discount_minor: numberValue(row.discount_minor),
    credit_minor: numberValue(row.credit_minor),
    gross_profit_minor: row.gross_profit_minor == null ? null : numberValue(row.gross_profit_minor),
    sold_at: textValue(row.sold_at),
    cashier_id: typeof row.cashier_id === 'string' ? row.cashier_id : null,
  };
}

function mapCustomer(value: unknown): Customer | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Raw;
  if (typeof row.id !== 'string' || typeof row.business_id !== 'string' || typeof row.name !== 'string') return null;
  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    phone: typeof row.phone === 'string' ? row.phone : null,
  };
}

function mapSaleItem(value: unknown): SaleItem {
  const row = value as Raw;
  const product = relation(row.product);
  return {
    id: textValue(row.id),
    product_id: textValue(row.product_id),
    name: textValue(row.product_name, textValue(product?.name, 'Product')),
    quantity: numberValue(row.quantity),
    unit_price_minor: numberValue(row.unit_price_minor),
    line_total_minor: numberValue(row.line_total_minor, numberValue(row.quantity) * numberValue(row.unit_price_minor)),
  };
}

function mapPayment(value: unknown): SalePayment {
  const row = value as Raw;
  return {
    id: textValue(row.id),
    method: textValue(row.method),
    amount_minor: numberValue(row.amount_minor),
    reference: typeof row.reference === 'string' ? row.reference : null,
  };
}

async function cashierNames(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds);
  if (error) throw new Error(friendlyErrorMessage(error));
  return new Map((data ?? []).flatMap((row) =>
    typeof row.id === 'string' && typeof row.full_name === 'string'
      ? [[row.id, row.full_name] as const]
      : [],
  ));
}

export async function listSellableProducts(businessId: string, options: { search?: string; categoryId?: string } = {}): Promise<Product[]> {
  let query = supabase.from('products')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (options.categoryId) query = query.eq('category_id', options.categoryId);
  const term = options.search?.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(friendlyErrorMessage(error));
  const rows = data ?? [];
  const categoryIds = [...new Set(rows.flatMap((row) => typeof row.category_id === 'string' ? [row.category_id] : []))];
  const categoriesResult = categoryIds.length
    ? await supabase.from('categories').select('id, name').in('id', categoryIds)
    : { data: [], error: null };
  if (categoriesResult.error) throw new Error(friendlyErrorMessage(categoriesResult.error));
  const categoryNames = new Map((categoriesResult.data ?? []).flatMap((row) =>
    typeof row.id === 'string' && typeof row.name === 'string' ? [[row.id, row.name] as const] : [],
  ));
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    business_id: row.business_id,
    category_id: row.category_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    image_path: row.image_path,
    image_url: row.image_path ? await getImageUrl(row.image_path) : null,
    cost_price_minor: row.cost_price_minor,
    selling_price_minor: row.selling_price_minor,
    quantity: row.quantity,
    low_stock_threshold: row.low_stock_threshold,
    deleted_at: row.deleted_at,
    category_name: typeof row.category_id === 'string' ? categoryNames.get(row.category_id) ?? null : null,
  } as Product)));
}

export async function createSale(input: {
  saleId: string;
  businessId: string;
  customerId: string | null;
  items: CartItem[];
  discountMinor: number;
  payments: PaymentInput[];
  soldAt?: string;
}): Promise<string> {
  if (!Number.isSafeInteger(input.discountMinor) || input.discountMinor < 0) {
    throw new Error('Invalid discount.');
  }
  const { data, error } = await supabase.rpc('create_sale', {
    p_sale_id: input.saleId,
    p_business_id: input.businessId,
    p_customer_id: input.customerId,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price_minor: item.unitPriceMinor,
    })),
    p_discount_minor: input.discountMinor,
    p_payments: input.payments.map((payment) => ({
      method: payment.method,
      amount_minor: payment.amountMinor,
      reference: payment.reference,
    })),
    p_sold_at: input.soldAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(friendlyErrorMessage(error));
  return typeof data === 'string' ? data : input.saleId;
}

export async function getSale(saleId: string): Promise<SaleRecord> {
  const { data, error } = await supabase.from('sales')
    .select('*, sale_items(*), sale_payments(*), customer:customers(id, business_id, name, phone)')
    .eq('id', saleId)
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  const row = data as unknown as Raw;
  const sale = mapSale(row);
  const cashier = sale.cashier_id ? await cashierNames([sale.cashier_id]) : new Map<string, string>();
  const items = (Array.isArray(row.sale_items) ? row.sale_items : []).map(mapSaleItem);
  const payments = (Array.isArray(row.sale_payments) ? row.sale_payments : []).map(mapPayment);
  return {
    sale,
    items,
    payments,
    customer: mapCustomer(relation(row.customer)),
    cashierName: sale.cashier_id ? cashier.get(sale.cashier_id) ?? 'Team member' : 'Team member',
  };
}

export async function listSales(
  businessId: string,
  options: { page?: number; range?: 'today' | '7days' | '30days' | 'credit' } = {},
): Promise<{ rows: SaleListRow[]; total: number; dayTotals: { totalMinor: number; profitMinor: number } }> {
  const pageSize = 30;
  const page = Math.max(0, options.page ?? 0);
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  let query = supabase.from('sales')
    .select('*, customer:customers(name), sale_payments(method)', { count: 'exact' })
    .eq('business_id', businessId)
    .order('sold_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (options.range === 'today') query = query.gte('sold_at', startOfToday.toISOString());
  if (options.range === '7days') query = query.gte('sold_at', new Date(now.getTime() - 7 * 86400000).toISOString());
  if (options.range === '30days') query = query.gte('sold_at', new Date(now.getTime() - 30 * 86400000).toISOString());
  if (options.range === 'credit') query = query.gt('credit_minor', 0);
  const { data, count, error } = await query;
  if (error) throw new Error(friendlyErrorMessage(error));

  const rows = (data ?? []).map((value) => {
    const row = value as unknown as Raw;
    const sale = mapSale(row);
    const methods = Array.isArray(row.sale_payments)
      ? row.sale_payments.map((payment) => textValue((payment as Raw).method))
      : [];
    return { sale, customerName: textValue(relation(row.customer)?.name, 'Walk-in customer'), paymentMethods: methods };
  });

  const dayResult = await supabase.from('sales')
    .select('total_minor, gross_profit_minor')
    .eq('business_id', businessId)
    .gte('sold_at', startOfToday.toISOString())
    .lt('sold_at', new Date(startOfToday.getTime() + 86400000).toISOString());
  if (dayResult.error) throw new Error(friendlyErrorMessage(dayResult.error));
  const dayTotals = (dayResult.data ?? []).reduce((total, row) => ({
    totalMinor: total.totalMinor + numberValue(row.total_minor),
    profitMinor: total.profitMinor + numberValue(row.gross_profit_minor),
  }), { totalMinor: 0, profitMinor: 0 });
  if (!Number.isSafeInteger(dayTotals.totalMinor) || !Number.isSafeInteger(dayTotals.profitMinor)) {
    throw new Error('The daily sales total exceeds the supported range.');
  }
  return { rows, total: count ?? 0, dayTotals };
}

export async function getReceiptData(saleId: string): Promise<SaleReceiptData> {
  const record = await getSale(saleId);
  const { data, error } = await supabase.from('businesses')
    .select('name, address, phone, receipt_header, receipt_footer, show_logo_on_receipt, logo_path')
    .eq('id', record.sale.business_id)
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  const business = data as unknown as Raw;
  let logoUrl: string | null = null;
  const logoPath = typeof business.logo_path === 'string' ? business.logo_path : null;
  if (logoPath && business.show_logo_on_receipt === true) {
    const { data: signedUrl, error: logoError } = await supabase.storage
      .from('product-images')
      .createSignedUrl(logoPath, 60 * 60);
    if (logoError) throw new Error(friendlyErrorMessage(logoError));
    logoUrl = signedUrl.signedUrl;
  }
  return {
    ...record,
    business: {
      name: textValue(business.name),
      address: typeof business.address === 'string' ? business.address : null,
      phone: typeof business.phone === 'string' ? business.phone : null,
      receipt_header: typeof business.receipt_header === 'string' ? business.receipt_header : null,
      receipt_footer: typeof business.receipt_footer === 'string' ? business.receipt_footer : null,
      show_logo_on_receipt: business.show_logo_on_receipt === true,
      logo_path: logoPath,
      logo_url: logoUrl,
    },
  };
}
