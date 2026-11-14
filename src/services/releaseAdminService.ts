import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type AppRelease = {
  id: string;
  platform: 'android' | 'ios';
  version: string;
  min_supported_version: string;
  force_update: boolean;
  update_url: string | null;
  release_notes: string | null;
  status: 'draft' | 'published' | 'archived';
};

export type AppReleaseInput = Omit<AppRelease, 'id' | 'status'>;

function report(operation: string, error: unknown): Error {
  console.warn(`${operation} failed:`, error);
  return new Error(friendlyErrorMessage(error, 'admin'));
}

function validVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export async function listAppReleases(): Promise<AppRelease[]> {
  const { data, error } = await supabase.from('app_releases')
    .select('id, platform, version, min_supported_version, force_update, update_url, release_notes, status')
    .order('version', { ascending: false });
  if (error) throw report('App releases query', error);
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform === 'ios' ? 'ios' : 'android',
    version: row.version,
    min_supported_version: row.min_supported_version,
    force_update: row.force_update === true,
    update_url: row.update_url,
    release_notes: row.release_notes,
    status: row.status,
  })) as AppRelease[];
}

export async function saveAppReleaseDraft(input: AppReleaseInput, id?: string): Promise<string> {
  if (!validVersion(input.version) || !validVersion(input.min_supported_version)) {
    throw new Error('Use version numbers in x.y.z format.');
  }
  const values = {
    ...input,
    version: input.version.trim(),
    min_supported_version: input.min_supported_version.trim(),
    update_url: input.update_url?.trim() || null,
    release_notes: input.release_notes?.trim() || null,
    status: 'draft' as const,
  };
  const result = id
    ? await supabase.from('app_releases').update(values).eq('id', id).eq('status', 'draft').select('id').single()
    : await supabase.from('app_releases').insert(values).select('id').single();
  if (result.error) throw report('App release draft save', result.error);
  return result.data.id;
}

export async function deleteAppReleaseDraft(id: string): Promise<void> {
  const { error } = await supabase.from('app_releases').delete().eq('id', id).eq('status', 'draft');
  if (error) throw report('App release draft deletion', error);
}

export async function publishAppRelease(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_publish_release', { p_id: id });
  if (error) throw report('App release publish', error);
}
