import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type VerificationResponse = { enabled: boolean };

function isVerificationResponse(value: unknown): value is VerificationResponse {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).enabled === 'boolean';
}

async function invoke(action: 'get' | 'set', enabled?: boolean): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('manage-email-verification', {
    body: action === 'get' ? { action } : { action, enabled },
  });
  if (error) throw new Error(friendlyErrorMessage(error, 'admin'));
  if (!isVerificationResponse(data)) {
    throw new Error('The email verification setting returned an invalid response.');
  }
  return data.enabled;
}

export async function getEmailVerificationRequired(): Promise<boolean> {
  return invoke('get');
}

export async function setEmailVerificationRequired(enabled: boolean): Promise<void> {
  const saved = await invoke('set', enabled);
  if (saved !== enabled) {
    throw new Error('The email verification setting could not be confirmed. Refresh and try again.');
  }
}
