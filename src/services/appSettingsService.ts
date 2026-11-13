import AsyncStorage from '@react-native-async-storage/async-storage';

import { support } from '@/constants/support';
import { supabase } from '@/lib/supabase';

export type PublicAppSettings = {
  appName: string;
  tagline: string;
  supportEmail: string;
  supportWhatsapp: string;
  supportPhone: string;
};

const storageKey = '@mishop/public-app-settings';
const defaults: PublicAppSettings = {
  appName: 'MiShop',
  tagline: 'Your Business, Under Control.',
  supportEmail: support.email,
  supportWhatsapp: support.whatsappNumber,
  supportPhone: support.phoneNumber,
};
const keys = ['app_name', 'tagline', 'support_email', 'support_whatsapp', 'support_phone'];

function settingString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === 'string' && nested.trim() ? nested.trim() : null;
  }
  return null;
}

function mapSettings(rows: unknown): PublicAppSettings {
  if (!Array.isArray(rows)) return defaults;
  const found = new Map<string, string>();
  for (const value of rows) {
    if (typeof value !== 'object' || value === null) continue;
    const row = value as Record<string, unknown>;
    if (typeof row.key !== 'string') continue;
    const text = settingString(row.value);
    if (text) found.set(row.key, text);
  }
  return {
    appName: found.get('app_name') ?? defaults.appName,
    tagline: found.get('tagline') ?? defaults.tagline,
    supportEmail: found.get('support_email') ?? defaults.supportEmail,
    supportWhatsapp: found.get('support_whatsapp') ?? defaults.supportWhatsapp,
    supportPhone: found.get('support_phone') ?? defaults.supportPhone,
  };
}

export async function getPublicAppSettings(): Promise<PublicAppSettings> {
  const { data, error } = await supabase.from('app_settings')
    .select('key, value')
    .eq('is_public', true)
    .in('key', keys);

  if (error) {
    console.warn('Public app settings query failed:', error);
    const cached = await AsyncStorage.getItem(storageKey);
    if (!cached) throw error;
    try {
      return { ...defaults, ...JSON.parse(cached) as Partial<PublicAppSettings> };
    } catch (cacheError) {
      console.warn('Cached public app settings could not be read:', cacheError);
      return defaults;
    }
  }

  const settings = mapSettings(data);
  await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
  return settings;
}

export function getDefaultPublicAppSettings(): PublicAppSettings {
  return defaults;
}
