import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { friendlyErrorMessage } from '@/lib/errors';
import { receiptHtml } from '@/lib/receipt/receiptHtml';
import { receiptPageSize } from '@/lib/receipt/receiptHtml';
import type { ReceiptData, ReceiptLayout } from '@/lib/receipt/types';
import { formatMoney } from '@/lib/money';

const savedDirectoryKey = '@salonebiz/receipt-download-directory';

function safeReceiptName(receiptNo: string): string {
  const safe = receiptNo.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60) || 'receipt';
  return `MiShop-Receipt-${safe}.pdf`;
}

function rawErrorText(error: unknown): string {
  try {
    return JSON.stringify(error, error instanceof Error ? Object.getOwnPropertyNames(error) : undefined);
  } catch {
    return String(error);
  }
}

export async function createReceiptPdf(data: ReceiptData, layout: ReceiptLayout = 'compact'): Promise<string> {
  let targetUri: string | null = null;
  try {
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) throw new Error('The app cache is not available.');
    const pageSize = receiptPageSize(data, layout);
    const printed = await Print.printToFileAsync({
      html: receiptHtml(data, {
        size: layout,
        fmt: (minor) => formatMoney(minor, data.business.currencyCode || 'SLE'),
      }),
      width: pageSize.width,
      height: pageSize.height,
      base64: true,
    });
    if (!printed.base64) throw new Error('The generated receipt PDF could not be read.');

    targetUri = `${cacheDirectory}${safeReceiptName(data.receiptNo)}`;
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.writeAsStringAsync(targetUri, printed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const info = await FileSystem.getInfoAsync(targetUri);
    if (!info.exists || !('size' in info) || typeof info.size !== 'number' || info.size <= 0) {
      throw new Error('The receipt PDF could not be verified.');
    }
    return targetUri;
  } catch (error) {
    console.warn('Receipt PDF generation failed:', rawErrorText(error));
    if (targetUri) {
      try {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Incomplete receipt PDF could not be removed:', rawErrorText(cleanupError));
      }
    }
    throw error;
  }
}

export async function isReceiptPdfAvailable(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0;
  } catch (error) {
    console.warn('Could not verify cached receipt PDF:', rawErrorText(error));
    return false;
  }
}

export async function shareReceipt(uri: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share receipt',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.warn('Receipt sharing failed:', rawErrorText(error));
    throw error;
  }
}

export async function shareReceiptImage(uri: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share receipt image',
      UTI: 'public.png',
    });
  } catch (error) {
    console.warn('Receipt image sharing failed:', rawErrorText(error));
    throw error;
  }
}

function folderLabel(uri: string): string {
  const lastPart = uri.split('/').pop() ?? '';
  const decoded = decodeURIComponent(lastPart);
  const name = decoded.split(':').pop()?.trim();
  return name || 'selected folder';
}

async function selectAndroidDirectory(): Promise<{ uri: string; label: string } | null> {
  const stored = await AsyncStorage.getItem(savedDirectoryKey);
  let initialUri: string | null = null;
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null && 'uri' in parsed && typeof parsed.uri === 'string') {
        initialUri = parsed.uri;
      }
    } catch (error) {
      console.warn('Saved receipt folder could not be read:', rawErrorText(error));
      await AsyncStorage.removeItem(savedDirectoryKey);
    }
  }
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
  if (!permission.granted) return null;
  return { uri: permission.directoryUri, label: folderLabel(permission.directoryUri) };
}

async function writeToAndroidDirectory(uri: string, directory: { uri: string; label: string }, fileName: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const nameWithoutExtension = fileName.replace(/\.pdf$/i, '');
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directory.uri,
    nameWithoutExtension,
    'application/pdf',
  );
  await FileSystem.StorageAccessFramework.writeAsStringAsync(
    targetUri,
    base64,
    { encoding: FileSystem.EncodingType.Base64 },
  );
  await AsyncStorage.setItem(savedDirectoryKey, JSON.stringify(directory));
  return `Saved to ${directory.label}`;
}

export async function downloadReceipt(uri: string, fileName: string): Promise<string> {
  if (Platform.OS === 'ios') {
    await shareReceipt(uri);
    return 'Choose Save to Files in the share sheet.';
  }
  if (Platform.OS === 'android') {
    try {
      let storedDirectory: { uri: string; label: string } | null = null;
      const stored = await AsyncStorage.getItem(savedDirectoryKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          typeof parsed === 'object'
          && parsed !== null
          && 'uri' in parsed
          && typeof parsed.uri === 'string'
          && 'label' in parsed
          && typeof parsed.label === 'string'
        ) {
          storedDirectory = { uri: parsed.uri, label: parsed.label };
        }
      }
      const directory = storedDirectory ?? await selectAndroidDirectory();
      if (directory) return await writeToAndroidDirectory(uri, directory, fileName);
    } catch (error) {
      console.warn('Saving receipt to Android storage failed:', rawErrorText(error));
    }
  }
  await shareReceipt(uri);
  return 'Choose a folder in the share sheet to save the PDF.';
}

export async function printReceipt(data: ReceiptData, layout: ReceiptLayout): Promise<void> {
  try {
    const pageSize = receiptPageSize(data, layout);
    await Print.printAsync({
      html: receiptHtml(data, {
        size: layout,
        fmt: (minor) => formatMoney(minor, data.business.currencyCode || 'SLE'),
      }),
      width: pageSize.width,
      height: pageSize.height,
    });
  } catch (error) {
    console.warn('Printing receipt failed:', rawErrorText(error));
    throw error;
  }
}

export function receiptFriendlyError(error: unknown): string {
  return friendlyErrorMessage(error, 'receipt');
}
