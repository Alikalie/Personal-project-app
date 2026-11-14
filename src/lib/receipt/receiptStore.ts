import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReceiptData } from '@/lib/receipt/types';

const receiptKey = (key: string) => `@salonebiz/receipt/${key}`;

function isReceiptData(value: unknown): value is ReceiptData {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (record.kind === 'sale' || record.kind === 'repayment')
    && typeof record.receiptNo === 'string'
    && typeof record.issuedAt === 'string'
    && typeof record.business === 'object'
    && record.business !== null;
}

export async function saveReceiptData(key: string, data: ReceiptData): Promise<void> {
  await AsyncStorage.setItem(receiptKey(key), JSON.stringify(data));
}

export async function loadReceiptData(key: string): Promise<ReceiptData | null> {
  const stored = await AsyncStorage.getItem(receiptKey(key));
  if (!stored) return null;
  const parsed: unknown = JSON.parse(stored);
  return isReceiptData(parsed) ? parsed : null;
}

export async function clearReceiptDataCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const receiptKeys = keys.filter((key) => key.startsWith('@salonebiz/receipt/'));
  if (receiptKeys.length) await AsyncStorage.multiRemove(receiptKeys);
}
