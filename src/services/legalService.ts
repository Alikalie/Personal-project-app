import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type LegalDocumentType = 'privacy' | 'terms';

export type LegalDocument = {
  id: string;
  doc_type: LegalDocumentType;
  version: number;
  title: string;
  body_md: string;
  change_summary: string | null;
  effective_date: string | null;
  published_at: string | null;
};

export type RequiredLegalAcceptance = {
  doc_type: LegalDocumentType;
  version: number;
  title: string;
};

const publishedCacheKey = (type: LegalDocumentType) => `@mishop/legal/published/${type}`;
const acceptedCacheKey = (userId: string) => `@mishop/legal/accepted/${userId}`;
const pendingSignupKey = '@mishop/legal/pending-signup-user';

function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return value === 'privacy' || value === 'terms';
}

function mapDocument(value: unknown): LegalDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string'
    || !isLegalDocumentType(row.doc_type)
    || typeof row.version !== 'number'
    || !Number.isSafeInteger(row.version)
    || typeof row.title !== 'string'
    || typeof row.body_md !== 'string'
  ) return null;
  return {
    id: row.id,
    doc_type: row.doc_type,
    version: row.version,
    title: row.title,
    body_md: row.body_md,
    change_summary: typeof row.change_summary === 'string' ? row.change_summary : null,
    effective_date: typeof row.effective_date === 'string' ? row.effective_date : null,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
  };
}

export async function getPublishedLegalDocument(type: LegalDocumentType): Promise<{
  document: LegalDocument;
  offline: boolean;
}> {
  const { data, error } = await supabase.from('legal_documents')
    .select('id, doc_type, version, title, body_md, change_summary, effective_date, published_at')
    .eq('doc_type', type)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`Published ${type} document query failed:`, error);
    const cached = await AsyncStorage.getItem(publishedCacheKey(type));
    if (!cached) throw error;
    const document = mapDocument(JSON.parse(cached));
    if (!document) throw new Error('The saved legal document is invalid.');
    return { document, offline: true };
  }

  const document = mapDocument(data);
  if (!document) throw new Error(`The published ${type} document is not available.`);
  await AsyncStorage.setItem(publishedCacheKey(type), JSON.stringify(document));
  return { document, offline: false };
}

export async function getRequiredLegalAcceptance(): Promise<RequiredLegalAcceptance[]> {
  const { data, error } = await supabase.rpc('legal_acceptance_required');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('The server returned invalid legal acceptance data.');
  return data.flatMap((value): RequiredLegalAcceptance[] => {
    if (typeof value !== 'object' || value === null) return [];
    const row = value as Record<string, unknown>;
    if (
      !isLegalDocumentType(row.doc_type)
      || typeof row.version !== 'number'
      || !Number.isSafeInteger(row.version)
      || typeof row.title !== 'string'
    ) return [];
    return [{ doc_type: row.doc_type, version: row.version, title: row.title }];
  });
}

export async function acceptPublishedLegalDocuments(appVersion: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_legal_documents', { p_app_version: appVersion });
  if (error) throw error;
  await AsyncStorage.setItem(acceptedCacheKey(userId), 'true');
  if ((await AsyncStorage.getItem(pendingSignupKey)) === userId) {
    await AsyncStorage.removeItem(pendingSignupKey);
  }
}

export async function hasPreviouslyAcceptedLegal(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(acceptedCacheKey(userId))) === 'true';
}

export async function rememberSignupConsent(userId: string): Promise<void> {
  await AsyncStorage.setItem(pendingSignupKey, userId);
}

export async function acceptSignupConsentIfPending(userId: string, appVersion: string): Promise<void> {
  if ((await AsyncStorage.getItem(pendingSignupKey)) !== userId) return;
  await acceptPublishedLegalDocuments(appVersion, userId);
}

export async function rememberCurrentLegalAccepted(userId: string): Promise<void> {
  await AsyncStorage.setItem(acceptedCacheKey(userId), 'true');
}
