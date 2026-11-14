import type { CustomerLedgerEntry } from '@/services/customerService';
import type { SaleReceiptData as ServiceSaleReceiptData, SaleRecord } from '@/services/salesService';
import type { ReceiptData } from '@/lib/receipt/receiptHtml';

export type ReceiptBusinessSettings = {
  name: string | null;
  address: string | null;
  phone: string | null;
  receipt_header: string | null;
  receipt_footer: string | null;
  currency_code?: string | null;
  show_logo_on_receipt?: boolean;
  logo_data_uri?: string | null;
};

function safeMinor(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`The ${label} is not a valid amount.`);
  }
  return value;
}

export function receiptDateText(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function receiptBusiness(settings: ReceiptBusinessSettings): NonNullable<ReceiptData['business']> {
  return {
    name: settings.name?.trim() || 'Your business',
    address: settings.address?.trim() || null,
    phone: settings.phone?.trim() || null,
    header: settings.receipt_header?.trim() || null,
    footer: settings.receipt_footer?.trim() || null,
    currencyCode: settings.currency_code?.trim() || 'SLE',
    logoDataUri: settings.show_logo_on_receipt && settings.logo_data_uri?.startsWith('data:image/')
      ? settings.logo_data_uri
      : null,
  };
}

export function buildSaleReceiptData(
  record: SaleRecord,
  settings: ReceiptBusinessSettings,
  changeMinor = 0,
): ReceiptData {
  const items = record.items.map((item) => ({
    name: item.name,
    qty: item.quantity,
    unitMinor: safeMinor(item.unit_price_minor, 'unit price'),
    totalMinor: safeMinor(item.line_total_minor, 'line total'),
  }));
  const subtotalMinor = items.reduce((sum, item) => {
    const total = sum + item.totalMinor;
    if (!Number.isSafeInteger(total)) throw new Error('The receipt total is too large.');
    return total;
  }, 0);
  return {
    type: 'sale',
    receiptNo: record.sale.receipt_no || record.sale.id,
    dateText: receiptDateText(record.sale.sold_at || new Date().toISOString()),
    business: receiptBusiness(settings),
    cashierName: record.cashierName || 'Team member',
    customer: record.customer ? { name: record.customer.name, phone: record.customer.phone } : null,
    items,
    subtotalMinor,
    discountMinor: safeMinor(record.sale.discount_minor, 'discount'),
    totalMinor: safeMinor(record.sale.total_minor, 'sale total'),
    payments: record.payments.map((payment) => ({
      method: payment.method,
      amountMinor: safeMinor(payment.amount_minor, 'payment'),
      reference: payment.reference,
    })),
    changeGivenMinor: safeMinor(changeMinor, 'change'),
    creditMinor: safeMinor(record.sale.credit_minor, 'credit balance'),
  };
}

export function buildSaleReceiptFromReceiptData(source: ServiceSaleReceiptData): ReceiptData {
  return buildSaleReceiptData(source, {
    name: source.business.name,
    address: source.business.address,
    phone: source.business.phone,
    receipt_header: source.business.receipt_header,
    receipt_footer: source.business.receipt_footer,
    currency_code: source.business.currency_code,
    show_logo_on_receipt: source.business.show_logo_on_receipt,
    logo_data_uri: source.business.logo_data_uri,
  });
}

export function calculateNewCustomerBalance(previousBalanceMinor: number, paymentMinor: number): number {
  if (!Number.isSafeInteger(previousBalanceMinor) || previousBalanceMinor < 0) {
    throw new Error('The previous balance is invalid.');
  }
  if (!Number.isSafeInteger(paymentMinor) || paymentMinor <= 0 || paymentMinor > previousBalanceMinor) {
    throw new Error('Enter a payment between zero and the balance owed.');
  }
  return previousBalanceMinor - paymentMinor;
}

export function buildRepaymentReceiptData(input: {
  entryId: string;
  createdAt: string;
  business: ReceiptBusinessSettings;
  cashierName: string;
  customerName: string;
  customerPhone: string | null;
  amountMinor: number;
  method: string;
  note: string | null;
  previousBalanceMinor: number;
  newBalanceMinor: number;
}): ReceiptData {
  const amountMinor = safeMinor(input.amountMinor, 'payment');
  if (amountMinor === 0) throw new Error('A receipt needs a payment greater than zero.');
  return {
    type: 'payment',
    receiptNo: `PAY-${input.entryId.slice(0, 8).toUpperCase()}`,
    dateText: receiptDateText(input.createdAt),
    business: receiptBusiness(input.business),
    cashierName: input.cashierName || 'Team member',
    customer: { name: input.customerName, phone: input.customerPhone },
    items: [],
    subtotalMinor: 0,
    discountMinor: 0,
    totalMinor: 0,
    payments: [{ method: input.method, amountMinor }],
    changeGivenMinor: 0,
    creditMinor: 0,
    customerBalanceAfterMinor: safeMinor(input.newBalanceMinor, 'new balance'),
  };
}

export function repaymentReceiptFromLedger(input: {
  entry: CustomerLedgerEntry;
  previousBalanceMinor: number;
  customerName: string;
  customerPhone: string | null;
  business: ReceiptBusinessSettings;
  cashierName: string;
}): ReceiptData {
  const entry = input.entry;
  if (entry.entry_type !== 'repayment' || !entry.method) {
    throw new Error('This activity does not have a payment receipt.');
  }
  const amountMinor = Math.abs(entry.amount_minor);
  return buildRepaymentReceiptData({
    entryId: entry.id,
    createdAt: entry.created_at,
    business: input.business,
    cashierName: entry.created_by_name || input.cashierName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    amountMinor,
    method: entry.method,
    note: entry.note,
    previousBalanceMinor: input.previousBalanceMinor,
    newBalanceMinor: input.previousBalanceMinor - amountMinor,
  });
}
