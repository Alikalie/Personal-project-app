import type { CustomerLedgerEntry } from '@/services/customerService';
import type { SaleReceiptData as ServiceSaleReceiptData, SaleRecord } from '@/services/salesService';
import type { ReceiptBusiness, ReceiptData, RepaymentReceiptData, SaleReceiptData } from '@/lib/receipt/types';

export type ReceiptBusinessSettings = {
  name: string | null;
  address: string | null;
  phone: string | null;
  receipt_header: string | null;
  receipt_footer: string | null;
  show_logo_on_receipt?: boolean;
  logo_data_uri?: string | null;
};

function safeMinor(value: number, label: string): number {
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded < 0) {
    throw new Error(`The ${label} is not a valid amount.`);
  }
  return rounded;
}

export function receiptBusiness(settings: ReceiptBusinessSettings): ReceiptBusiness {
  return {
    name: settings.name?.trim() || 'Your business',
    address: settings.address?.trim() || null,
    phone: settings.phone?.trim() || null,
    header: settings.receipt_header?.trim() || null,
    footer: settings.receipt_footer?.trim() || null,
    logoDataUri: settings.show_logo_on_receipt && settings.logo_data_uri?.startsWith('data:image/')
      ? settings.logo_data_uri
      : null,
  };
}

export function buildSaleReceiptData(
  record: SaleRecord,
  settings: ReceiptBusinessSettings,
  changeMinor = 0,
): SaleReceiptData {
  const items = record.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPriceMinor: safeMinor(item.unit_price_minor, 'unit price'),
    lineTotalMinor: safeMinor(item.line_total_minor, 'line total'),
  }));
  const subtotalMinor = items.reduce((sum, item) => {
    const total = sum + item.lineTotalMinor;
    if (!Number.isSafeInteger(total)) throw new Error('The receipt total is too large.');
    return total;
  }, 0);
  const totalMinor = safeMinor(record.sale.total_minor, 'sale total');
  const discountMinor = safeMinor(record.sale.discount_minor, 'discount');
  const payments = record.payments.map((payment) => ({
    method: payment.method,
    amountMinor: safeMinor(payment.amount_minor, 'payment'),
  }));
  return {
    kind: 'sale',
    receiptNo: record.sale.receipt_no || record.sale.id,
    issuedAt: record.sale.sold_at || new Date().toISOString(),
    business: receiptBusiness(settings),
    cashierName: record.cashierName || 'Team member',
    customerName: record.customer?.name ?? null,
    customerPhone: record.customer?.phone ?? null,
    items,
    subtotalMinor,
    discountMinor,
    totalMinor,
    payments,
    balanceOwedMinor: safeMinor(record.sale.credit_minor, 'credit balance'),
    changeMinor: safeMinor(changeMinor, 'change'),
  };
}

export function buildSaleReceiptFromReceiptData(
  source: ServiceSaleReceiptData,
): SaleReceiptData {
  return buildSaleReceiptData(source, {
    name: source.business.name,
    address: source.business.address,
    phone: source.business.phone,
    receipt_header: source.business.receipt_header,
    receipt_footer: source.business.receipt_footer,
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
}): RepaymentReceiptData {
  const amountMinor = safeMinor(input.amountMinor, 'payment');
  if (amountMinor === 0) throw new Error('A receipt needs a payment greater than zero.');
  return {
    kind: 'repayment',
    entryId: input.entryId,
    receiptNo: `PAY-${input.entryId.slice(0, 8).toUpperCase()}`,
    issuedAt: input.createdAt,
    business: receiptBusiness(input.business),
    cashierName: input.cashierName || 'Team member',
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    paymentMinor: amountMinor,
    method: input.method,
    note: input.note,
    previousBalanceMinor: safeMinor(input.previousBalanceMinor, 'previous balance'),
    newBalanceMinor: safeMinor(input.newBalanceMinor, 'new balance'),
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

// Examples: parseSLEToMinorUnits('Le 25') is 2,500; ('25.50') is 2,550; empty and negative strings throw.
// Example: a 2,500 balance less a 1,000 payment is a 1,500 new balance.
