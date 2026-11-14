import AsyncStorage from '@react-native-async-storage/async-storage';

import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type Announcement = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  audience: 'all' | 'owners';
  starts_at: string | null;
  ends_at: string | null;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export type AdminAnnouncement = Announcement & {
  is_active: boolean;
};

export type AdminFAQItem = FAQItem & {
  is_published: boolean;
};

export type AppSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  is_public: boolean;
};

function report(operation: string, error: unknown): Error {
  console.warn(`${operation} failed:`, error);
  return new Error(friendlyErrorMessage(error, 'admin'));
}

const announcementsCacheKey = '@mishop/content/announcements';
const faqCacheKey = '@mishop/content/faq';

function isAnnouncement(value: unknown): value is Announcement {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.title === 'string'
    && typeof row.message === 'string'
    && ['info', 'warning', 'critical'].includes(String(row.severity))
    && ['all', 'owners'].includes(String(row.audience));
}

function isFAQItem(value: unknown): value is FAQItem {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.question === 'string'
    && typeof row.answer === 'string'
    && typeof row.sort_order === 'number';
}

function isInTimeWindow(item: Announcement, now: number): boolean {
  const startsAt = item.starts_at ? Date.parse(item.starts_at) : Number.NEGATIVE_INFINITY;
  const endsAt = item.ends_at ? Date.parse(item.ends_at) : Number.POSITIVE_INFINITY;
  return startsAt <= now && endsAt >= now;
}

async function getCached<T>(key: string, validate: (value: unknown) => value is T): Promise<T[]> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch (error) {
    console.warn('Cached public content is invalid:', error);
    await AsyncStorage.removeItem(key);
    return [];
  }
}

export async function listActiveAnnouncements(): Promise<{ items: Announcement[]; offline: boolean }> {
  const { data, error } = await supabase.from('announcements')
    .select('id, title, message, severity, audience, starts_at, ends_at')
    .eq('is_active', true);
  if (error) {
    console.warn('Public announcements query failed:', error);
    return { items: await getCached(announcementsCacheKey, isAnnouncement), offline: true };
  }

  const now = Date.now();
  const items = (data ?? [])
    .filter(isAnnouncement)
    .filter((item) => isInTimeWindow(item, now));
  await AsyncStorage.setItem(announcementsCacheKey, JSON.stringify(items));
  return { items, offline: false };
}

export async function listPublishedFAQ(): Promise<{ items: FAQItem[]; offline: boolean }> {
  const { data, error } = await supabase.from('faq_items')
    .select('id, question, answer, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('Published FAQ query failed:', error);
    return { items: await getCached(faqCacheKey, isFAQItem), offline: true };
  }

  const items = (data ?? []).filter(isFAQItem);
  await AsyncStorage.setItem(faqCacheKey, JSON.stringify(items));
  return { items, offline: false };
}

export async function getDismissedAnnouncementIds(): Promise<string[]> {
  const key = '@mishop/content/dismissed-announcements';
  const value = await AsyncStorage.getItem(key);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch (error) {
    console.warn('Dismissed announcement list is invalid:', error);
    await AsyncStorage.removeItem(key);
    return [];
  }
}

export async function dismissAnnouncement(id: string): Promise<string[]> {
  const ids = await getDismissedAnnouncementIds();
  const updated = [...new Set([...ids, id])];
  await AsyncStorage.setItem('@mishop/content/dismissed-announcements', JSON.stringify(updated));
  return updated;
}

export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data, error } = await supabase.from('announcements')
    .select('id, title, message, severity, audience, starts_at, ends_at, is_active')
    .order('starts_at', { ascending: false });
  if (error) throw report('Announcements query', error);
  return (data ?? []).filter((row) => typeof row.id === 'string').map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity,
    audience: row.audience,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_active: row.is_active === true,
  })) as AdminAnnouncement[];
}

export async function saveAnnouncement(input: Omit<AdminAnnouncement, 'id'>, id?: string): Promise<void> {
  const values = {
    title: input.title.trim(),
    message: input.message.trim(),
    severity: input.severity,
    audience: input.audience,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    is_active: input.is_active,
  };
  if (!values.title || !values.message) throw new Error('Enter an announcement title and message.');
  const result = id
    ? await supabase.from('announcements').update(values).eq('id', id)
    : await supabase.from('announcements').insert(values);
  if (result.error) throw report('Announcement save', result.error);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw report('Announcement deletion', error);
}

export async function listAdminFAQ(): Promise<AdminFAQItem[]> {
  const { data, error } = await supabase.from('faq_items')
    .select('id, question, answer, sort_order, is_published')
    .order('sort_order', { ascending: true });
  if (error) throw report('FAQ query', error);
  return (data ?? []).filter((row) => typeof row.id === 'string').map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    sort_order: row.sort_order,
    is_published: row.is_published === true,
  })) as AdminFAQItem[];
}

export async function saveFAQItem(input: Omit<AdminFAQItem, 'id'>, id?: string): Promise<void> {
  const values = {
    question: input.question.trim(),
    answer: input.answer.trim(),
    sort_order: Math.round(input.sort_order),
    is_published: input.is_published,
  };
  if (!values.question || !values.answer || !Number.isSafeInteger(values.sort_order)) {
    throw new Error('Enter a question and answer.');
  }
  const result = id
    ? await supabase.from('faq_items').update(values).eq('id', id)
    : await supabase.from('faq_items').insert(values);
  if (result.error) throw report('FAQ save', result.error);
}

export async function deleteFAQItem(id: string): Promise<void> {
  const { error } = await supabase.from('faq_items').delete().eq('id', id);
  if (error) throw report('FAQ deletion', error);
}

export async function listAppSettings(): Promise<AppSettingRow[]> {
  const { data, error } = await supabase.from('app_settings')
    .select('key, value, description, is_public')
    .order('key', { ascending: true });
  if (error) throw report('App settings query', error);
  return (data ?? []).filter((row) => typeof row.key === 'string').map((row) => ({
    key: row.key,
    value: row.value,
    description: typeof row.description === 'string' ? row.description : null,
    is_public: row.is_public === true,
  }));
}

export async function saveAppSetting(input: AppSettingRow): Promise<void> {
  if (!input.key.trim()) throw new Error('Enter a setting key.');
  const { error } = await supabase.from('app_settings').upsert({
    key: input.key.trim(),
    value: input.value,
    description: input.description?.trim() || null,
    is_public: input.is_public,
  });
  if (error) throw report('App setting save', error);
}
