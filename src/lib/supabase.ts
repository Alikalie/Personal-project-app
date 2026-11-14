import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { authStorage } from '@/lib/authStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt += 1) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (init?.signal?.aborted) controller.abort();
    else init?.signal?.addEventListener('abort', forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (init?.signal?.aborted || attempt === (method === 'GET' ? 2 : 0)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
      init?.signal?.removeEventListener('abort', forwardAbort);
    }
  }
  throw new Error('The request could not be completed.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
