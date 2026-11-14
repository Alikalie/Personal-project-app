import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { LegalDocument, LegalDocumentType } from '@/services/legalService';

export type LegalVersionRow = LegalDocument & { status: 'draft' | 'published' | 'archived' };

function report(operation: string, error: unknown): Error {
  console.warn(`${operation} failed:`, error);
  return new Error(friendlyErrorMessage(error, 'admin'));
}

export async function listLegalDocumentVersions(type?: LegalDocumentType): Promise<LegalVersionRow[]> {
  let query = supabase.from('legal_documents')
    .select('id, doc_type, version, title, body_md, change_summary, effective_date, published_at, status')
    .order('version', { ascending: false });
  if (type) query = query.eq('doc_type', type);
  const { data, error } = await query;
  if (error) throw report('Legal documents query', error);
  return (data ?? []).filter((row) => (
    typeof row.id === 'string'
    && (row.doc_type === 'privacy' || row.doc_type === 'terms')
    && typeof row.version === 'number'
    && typeof row.title === 'string'
    && typeof row.body_md === 'string'
    && ['draft', 'published', 'archived'].includes(String(row.status))
  )).map((row) => ({
    id: row.id,
    doc_type: row.doc_type,
    version: row.version,
    title: row.title,
    body_md: row.body_md,
    change_summary: row.change_summary ?? null,
    effective_date: row.effective_date ?? null,
    published_at: row.published_at ?? null,
    status: row.status as LegalVersionRow['status'],
  }));
}

export async function createLegalDraft(type: LegalDocumentType): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_legal_draft', { p_doc_type: type });
  if (error) throw report('Legal draft creation', error);
  if (typeof data !== 'string') throw new Error('The server did not return a draft id.');
  return data;
}

export async function saveLegalDraft(id: string, title: string, bodyMd: string): Promise<void> {
  const { error } = await supabase.from('legal_documents')
    .update({ title: title.trim(), body_md: bodyMd })
    .eq('id', id)
    .eq('status', 'draft');
  if (error) throw report('Legal draft update', error);
}

export async function deleteLegalDraft(id: string): Promise<void> {
  const { error } = await supabase.from('legal_documents').delete().eq('id', id).eq('status', 'draft');
  if (error) throw report('Legal draft deletion', error);
}

export async function publishLegalDraft(id: string, changeSummary: string, effectiveDate: string): Promise<void> {
  if (changeSummary.trim().length < 3) throw new Error('Describe what changed.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error('Enter an effective date as YYYY-MM-DD.');
  const { error } = await supabase.rpc('admin_publish_legal', {
    p_id: id,
    p_change_summary: changeSummary.trim(),
    p_effective: effectiveDate,
  });
  if (error) throw report('Legal document publish', error);
}

export async function getLegalAcceptanceCounts(type: LegalDocumentType, version: number): Promise<number> {
  const { count, error } = await supabase.from('legal_acceptances')
    .select('user_id', { count: 'exact', head: true })
    .eq('doc_type', type)
    .eq('version', version);
  if (error) throw report('Legal acceptance counts query', error);
  return count ?? 0;
}
