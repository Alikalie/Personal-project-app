import { supabase } from '@/lib/supabase';

export type AppReleaseStatus = {
  latestVersion: string;
  minimumSupportedVersion: string;
  updateAvailable: boolean;
  updateRequired: boolean;
  updateUrl: string | null;
  releaseNotes: string | null;
};

function mapStatus(value: unknown): AppReleaseStatus {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The server returned invalid update information.');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.latest_version !== 'string'
    || typeof row.min_supported_version !== 'string'
    || typeof row.update_available !== 'boolean'
    || typeof row.update_required !== 'boolean'
  ) throw new Error('The server returned invalid update information.');
  return {
    latestVersion: row.latest_version,
    minimumSupportedVersion: row.min_supported_version,
    updateAvailable: row.update_available,
    updateRequired: row.update_required,
    updateUrl: typeof row.update_url === 'string' && row.update_url.trim() ? row.update_url.trim() : null,
    releaseNotes: typeof row.release_notes === 'string' ? row.release_notes : null,
  };
}

export async function getAppReleaseStatus(
  platform: 'android' | 'ios',
  currentVersion: string,
  timeoutMs = 4500,
): Promise<AppReleaseStatus | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();
  try {
    const request = supabase.rpc('get_app_release_status', {
      p_platform: platform,
      p_current_version: currentVersion,
    }).abortSignal(controller.signal);
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Update check timed out.'));
      }, timeoutMs);
    });
    const result = await Promise.race([request, timedOut]);
    if (result.error) throw result.error;
    return mapStatus(result.data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Update check timed out.') {
      console.info('App update check timed out; continuing without blocking startup.');
    } else {
      console.warn('App update check failed; continuing without blocking startup:', error);
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
