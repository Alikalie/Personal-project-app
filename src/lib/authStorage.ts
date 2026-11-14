import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { newId } from '@/lib/uuid';

type Manifest = { version: string; count: number };
const chunkSize = 400;

function parseManifest(value: string): Manifest {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object'
    || parsed === null
    || typeof (parsed as Record<string, unknown>).version !== 'string'
    || !Number.isSafeInteger((parsed as Record<string, unknown>).count)
    || Number((parsed as Record<string, unknown>).count) < 1
  ) {
    throw new Error('The saved session is invalid. Sign in again.');
  }
  return parsed as Manifest;
}

function splitValue(value: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + chunkSize, value.length);
    const lastCodeUnit = value.charCodeAt(end - 1);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks.length ? chunks : [''];
}

async function readSecureValue(key: string, manifestValue: string): Promise<{ value: string; manifest: Manifest }> {
  const manifest = parseManifest(manifestValue);
  const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
    SecureStore.getItemAsync(`${key}.${manifest.version}.${index}`),
  ));
  if (chunks.some((chunk) => chunk === null)) throw new Error('The saved session is incomplete. Sign in again.');
  return { value: chunks.join(''), manifest };
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifestValue = await SecureStore.getItemAsync(`${key}.manifest`);
    if (manifestValue) return (await readSecureValue(key, manifestValue)).value;

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;
    await authStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousManifestValue = await SecureStore.getItemAsync(`${key}.manifest`);
    const version = newId();
    const chunks = splitValue(value);
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(`${key}.${version}.${index}`, chunks[index]);
    }
    await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ version, count: chunks.length }));

    if (previousManifestValue) {
      const previous = parseManifest(previousManifestValue);
      await Promise.all(Array.from({ length: previous.count }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${previous.version}.${index}`),
      ));
    }
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key: string): Promise<void> {
    const manifestValue = await SecureStore.getItemAsync(`${key}.manifest`);
    if (manifestValue) {
      const manifest = parseManifest(manifestValue);
      await SecureStore.deleteItemAsync(`${key}.manifest`);
      await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${manifest.version}.${index}`),
      ));
    }
    await AsyncStorage.removeItem(key);
  },
};
