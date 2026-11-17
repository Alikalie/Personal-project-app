const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ActionRequest = { action: 'get' } | { action: 'set'; enabled: boolean };
type AuthConfig = { mailer_autoconfirm?: unknown };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function projectRefFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null;
    const projectRef = url.hostname.slice(0, -'.supabase.co'.length);
    return /^[a-z]{20}$/.test(projectRef) ? projectRef : null;
  } catch {
    return null;
  }
}

function parseRequest(value: unknown): ActionRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (row.action === 'get') return { action: 'get' };
  if (row.action === 'set' && typeof row.enabled === 'boolean') {
    return { action: 'set', enabled: row.enabled };
  }
  return null;
}

async function isSuperAdmin(
  supabaseUrl: string,
  serviceRoleKey: string,
  authorization: string,
): Promise<boolean | null> {
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: authorization },
  });
  if (userResponse.status === 401 || userResponse.status === 403) return false;
  if (!userResponse.ok) return null;

  const user = await userResponse.json() as { id?: unknown };
  if (typeof user.id !== 'string') return false;

  const query = new URLSearchParams({
    select: 'user_id',
    user_id: `eq.${user.id}`,
    level: 'eq.super_admin',
    limit: '1',
  });
  const adminResponse = await fetch(`${supabaseUrl}/rest/v1/platform_admins?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!adminResponse.ok) return null;
  const admins: unknown = await adminResponse.json();
  return Array.isArray(admins) && admins.length > 0;
}

async function readEmailVerification(
  projectRef: string,
  managementToken: string,
): Promise<boolean | null> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${managementToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    console.error('Auth config read failed with status:', response.status);
    return null;
  }

  const config = await response.json() as AuthConfig;
  return typeof config.mailer_autoconfirm === 'boolean' ? !config.mailer_autoconfirm : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return respond(401, { error: 'Sign in is required.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const managementToken = Deno.env.get('SUPABASE_MANAGEMENT_API_TOKEN');
  const projectRef = supabaseUrl ? projectRefFromUrl(supabaseUrl) : null;
  if (!supabaseUrl || !serviceRoleKey || !managementToken || !projectRef) {
    return respond(503, { error: 'The email verification service is not configured.' });
  }

  const admin = await isSuperAdmin(supabaseUrl, serviceRoleKey, authorization);
  if (admin === false) return respond(403, { error: 'Only a super admin can change this setting.' });
  if (admin === null) return respond(503, { error: 'Admin access could not be verified.' });

  let action: ActionRequest | null;
  try {
    const body = await request.json() as unknown;
    action = parseRequest(body);
  } catch {
    return respond(400, { error: 'A valid action is required.' });
  }
  if (!action) return respond(400, { error: 'A valid action is required.' });

  if (action.action === 'set') {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managementToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ mailer_autoconfirm: !action.enabled }),
    });
    if (!response.ok) {
      console.error('Auth config update failed with status:', response.status);
      return respond(502, { error: 'Supabase could not update email verification. Try again or check the backend configuration.' });
    }
  }

  const enabled = await readEmailVerification(projectRef, managementToken);
  if (enabled === null) return respond(502, { error: 'The email verification setting could not be confirmed.' });
  return respond(200, { enabled });
});
