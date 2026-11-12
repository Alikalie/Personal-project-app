import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type AdminOverview = {
  total_users: number;
  new_users_7d: number;
  suspended_users: number;
  total_businesses: number;
  suspended_businesses: number;
  active_businesses_7d: number;
  businesses_no_products: number;
  total_sales_count: number;
  sales_today: number;
};

export type SignupTrend = { stat_date: string; new_users: number; new_businesses: number };
export type AdminUserRow = {
  user_id: string;
  profile_code: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_suspended: boolean;
  platform_level: string | null;
  business_id: string | null;
  business_code: string | null;
  business_name: string | null;
  businesses_count: number;
  created_at: string;
};
export type AdminMembership = {
  business_id: string;
  business_code: string;
  name: string;
  role: string;
  is_suspended: boolean;
};
export type AdminUserDetail = AdminUserRow & {
  last_sign_in_at: string | null;
  suspended_reason: string | null;
  memberships: AdminMembership[];
};
export type AdminBusinessRow = {
  business_id: string;
  business_code: string;
  name: string;
  business_type: string | null;
  district: string | null;
  owner_email: string | null;
  owner_profile_code: string | null;
  is_suspended: boolean;
  members_count: number;
  products_count: number;
  sales_count: number;
  last_sale_at: string | null;
  created_at: string;
};
export type AdminBusinessDetail = AdminBusinessRow & {
  address: string | null;
  phone: string | null;
  suspended_reason: string | null;
  owner: { user_id: string; full_name: string; email: string; profile_code: string } | null;
  counts: { members: number; products: number; customers: number; sales: number; expenses: number };
  staff: { profile_code: string; full_name: string; role: string; user_id?: string }[];
};
export type AdminTeamMember = {
  user_id: string;
  profile_code: string;
  email: string;
  full_name: string;
  level: 'super_admin' | 'support';
  last_sign_in_at: string | null;
  created_at: string;
};
export type AdminAuditEntry = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: unknown;
  created_at: string;
};

type Raw = Record<string, unknown>;
const overviewCacheMs = 30_000;
let overviewCache: { value: AdminOverview; timestamp: number } | null = null;

function objectOf(value: unknown): Raw {
  return typeof value === 'object' && value !== null ? value as Raw : {};
}

function stringOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function numberOf(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function booleanOf(value: unknown): boolean {
  return value === true;
}

function mapOverview(value: unknown): AdminOverview {
  const row = objectOf(value);
  return {
    total_users: numberOf(row.total_users),
    new_users_7d: numberOf(row.new_users_7d),
    suspended_users: numberOf(row.suspended_users),
    total_businesses: numberOf(row.total_businesses),
    suspended_businesses: numberOf(row.suspended_businesses),
    active_businesses_7d: numberOf(row.active_businesses_7d),
    businesses_no_products: numberOf(row.businesses_no_products),
    total_sales_count: numberOf(row.total_sales_count),
    sales_today: numberOf(row.sales_today),
  };
}

function mapUser(value: unknown): AdminUserRow {
  const row = objectOf(value);
  return {
    user_id: stringOf(row.user_id),
    profile_code: stringOf(row.profile_code),
    email: stringOf(row.email),
    full_name: stringOf(row.full_name, 'Unnamed user'),
    phone: nullableString(row.phone),
    is_suspended: booleanOf(row.is_suspended),
    platform_level: nullableString(row.platform_level),
    business_id: nullableString(row.business_id),
    business_code: nullableString(row.business_code),
    business_name: nullableString(row.business_name),
    businesses_count: numberOf(row.businesses_count),
    created_at: stringOf(row.created_at),
  };
}

function mapBusiness(value: unknown): AdminBusinessRow {
  const row = objectOf(value);
  return {
    business_id: stringOf(row.business_id),
    business_code: stringOf(row.business_code),
    name: stringOf(row.name, 'Unnamed business'),
    business_type: nullableString(row.business_type),
    district: nullableString(row.district),
    owner_email: nullableString(row.owner_email),
    owner_profile_code: nullableString(row.owner_profile_code),
    is_suspended: booleanOf(row.is_suspended),
    members_count: numberOf(row.members_count),
    products_count: numberOf(row.products_count),
    sales_count: numberOf(row.sales_count),
    last_sale_at: nullableString(row.last_sale_at),
    created_at: stringOf(row.created_at),
  };
}

function mapRows<T>(value: unknown, mapper: (row: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapper) : [];
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
  missingFunctionFallback?: T,
): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data as T;
  } catch (error) {
    console.warn(`${name} RPC failed:`, error);
    const details = typeof error === 'object' && error !== null
      ? error as { code?: unknown; message?: unknown }
      : {};
    if (
      missingFunctionFallback !== undefined
      && details.code === 'PGRST202'
      && typeof details.message === 'string'
      && details.message.includes(name)
    ) {
      return missingFunctionFallback;
    }
    throw new Error(friendlyErrorMessage(error, 'admin'));
  }
}

export async function getAdminOverview(force = false): Promise<AdminOverview> {
  if (!force && overviewCache && Date.now() - overviewCache.timestamp < overviewCacheMs) {
    return overviewCache.value;
  }
  const overview = mapOverview(await rpc<unknown>('admin_overview'));
  overviewCache = { value: overview, timestamp: Date.now() };
  return overview;
}

export async function refreshAdminOverview(): Promise<AdminOverview> {
  overviewCache = null;
  return getAdminOverview(true);
}

export async function getSignupTrend(days: 7 | 30): Promise<SignupTrend[]> {
  return mapRows(await rpc<unknown>(
    'admin_signups_trend',
    { p_days: days },
    [],
  ), (value) => {
    const row = objectOf(value);
    return {
      stat_date: stringOf(row.stat_date),
      new_users: numberOf(row.new_users),
      new_businesses: numberOf(row.new_businesses),
    };
  });
}

export async function listAdminUsers(search: string, limit = 30, offset = 0): Promise<AdminUserRow[]> {
  return mapRows(await rpc<unknown>('admin_list_users', {
    p_search: search.trim() || null,
    p_limit: limit,
    p_offset: offset,
  }), mapUser);
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const value = await rpc<unknown>('admin_user_detail', { p_user_id: userId });
  const row = objectOf(value);
  const base = mapUser(row);
  return {
    ...base,
    last_sign_in_at: nullableString(row.last_sign_in_at),
    suspended_reason: nullableString(row.suspended_reason),
    memberships: mapRows(row.memberships, (value) => {
      const membership = objectOf(value);
      return {
        business_id: stringOf(membership.business_id),
        business_code: stringOf(membership.business_code),
        name: stringOf(membership.name, 'Business'),
        role: stringOf(membership.role),
        is_suspended: booleanOf(membership.is_suspended),
      };
    }),
  };
}

export async function listAdminBusinesses(search: string, limit = 30, offset = 0): Promise<AdminBusinessRow[]> {
  return mapRows(await rpc<unknown>('admin_list_businesses', {
    p_search: search.trim() || null,
    p_limit: limit,
    p_offset: offset,
  }), mapBusiness);
}

export async function getAdminBusinessDetail(businessId: string): Promise<AdminBusinessDetail> {
  const row = objectOf(await rpc<unknown>('admin_business_detail', { p_business_id: businessId }));
  const counts = objectOf(row.counts);
  const owner = row.owner && typeof row.owner === 'object' ? objectOf(row.owner) : null;
  return {
    ...mapBusiness(row),
    address: nullableString(row.address),
    phone: nullableString(row.phone),
    suspended_reason: nullableString(row.suspended_reason),
    owner: owner ? {
      user_id: stringOf(owner.user_id),
      full_name: stringOf(owner.full_name, 'Business owner'),
      email: stringOf(owner.email),
      profile_code: stringOf(owner.profile_code),
    } : null,
    counts: {
      members: numberOf(counts.members),
      products: numberOf(counts.products),
      customers: numberOf(counts.customers),
      sales: numberOf(counts.sales),
      expenses: numberOf(counts.expenses),
    },
    staff: mapRows(row.staff, (value) => {
      const staff = objectOf(value);
      return {
        profile_code: stringOf(staff.profile_code),
        full_name: stringOf(staff.full_name, 'Team member'),
        role: stringOf(staff.role),
        user_id: nullableString(staff.user_id) ?? undefined,
      };
    }),
  };
}

export async function setAdminUserSuspended(userId: string, suspended: boolean, reason: string): Promise<void> {
  await rpc<unknown>('admin_set_user_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason.trim(),
  });
  await refreshAdminOverview();
}

export async function setAdminBusinessSuspended(businessId: string, suspended: boolean, reason: string): Promise<void> {
  await rpc<unknown>('admin_set_business_suspended', {
    p_business_id: businessId,
    p_suspended: suspended,
    p_reason: reason.trim(),
  });
  await refreshAdminOverview();
}

export async function grantPlatformAdmin(userId: string, level: 'super_admin' | 'support'): Promise<void> {
  await rpc<unknown>('admin_grant_admin', { p_user_id: userId, p_level: level });
  await refreshAdminOverview();
}

export async function revokePlatformAdmin(userId: string): Promise<void> {
  await rpc<unknown>('admin_revoke_admin', { p_user_id: userId });
  await refreshAdminOverview();
}

export async function listPlatformAdmins(): Promise<AdminTeamMember[]> {
  return mapRows(await rpc<unknown>('admin_list_admins'), (value) => {
    const row = objectOf(value);
    return {
      user_id: stringOf(row.user_id),
      profile_code: stringOf(row.profile_code),
      email: stringOf(row.email),
      full_name: stringOf(row.full_name, 'Unnamed admin'),
      level: row.level === 'super_admin' ? 'super_admin' : 'support',
      last_sign_in_at: nullableString(row.last_sign_in_at),
      created_at: stringOf(row.created_at),
    };
  });
}

export async function listAdminAudit(limit = 30, offset = 0): Promise<AdminAuditEntry[]> {
  return mapRows(await rpc<unknown>('admin_audit_list', {
    p_limit: limit,
    p_offset: offset,
  }), (value) => {
    const row = objectOf(value);
    return {
      id: stringOf(row.id),
      admin_email: stringOf(row.admin_email),
      action: stringOf(row.action),
      target_type: stringOf(row.target_type),
      target_id: stringOf(row.target_id),
      details: row.details,
      created_at: stringOf(row.created_at),
    };
  });
}
