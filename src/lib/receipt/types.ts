import type { PaymentMethod } from '@/services/salesService';

export type ReceiptLayout = 'compact' | 'a4';

export type ReceiptBusiness = {
  name: string;
  address: string | null;
  phone: string | null;
  header: string | null;
  footer: string | null;
  logoDataUri: string | null;
};

export type ReceiptPayment = {
  method: PaymentMethod | string;
  amountMinor: number;
};

export type SaleReceiptData = {
  kind: 'sale';
  receiptNo: string;
  issuedAt: string;
  business: ReceiptBusiness;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  items: {
    name: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  payments: ReceiptPayment[];
  balanceOwedMinor: number;
  changeMinor: number;
};

export type RepaymentReceiptData = {
  kind: 'repayment';
  entryId: string;
  receiptNo: string;
  issuedAt: string;
  business: ReceiptBusiness;
  cashierName: string;
  customerName: string;
  customerPhone: string | null;
  paymentMinor: number;
  method: PaymentMethod | string;
  note: string | null;
  previousBalanceMinor: number;
  newBalanceMinor: number;
};

export type ReceiptData = SaleReceiptData | RepaymentReceiptData;
