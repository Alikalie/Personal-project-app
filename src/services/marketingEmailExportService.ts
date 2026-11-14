import { supabase } from '@/lib/supabase';

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportConsentedMarketingEmails(): Promise<{ csv: string; count: number }> {
  const { data, error } = await supabase.rpc('admin_export_emails', { p_only_marketing: true });
  if (error) {
    console.warn('Marketing email export RPC failed:', error);
    throw new Error('Could not export opted-in email addresses. Confirm your admin access and try again.');
  }

  if (!Array.isArray(data)) throw new Error('The server returned an invalid email export.');
  const emails = data.flatMap((row): string[] => {
    if (typeof row !== 'object' || row === null) return [];
    const email = (row as Record<string, unknown>).email;
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? [email.trim()]
      : [];
  });
  return { csv: ['email', ...emails.map(csvCell)].join('\r\n'), count: emails.length };
}
