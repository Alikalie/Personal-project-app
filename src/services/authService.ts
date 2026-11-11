import type { User } from '@supabase/supabase-js';
import type { Href } from 'expo-router';

import type { AuthUser } from '../components/AuthProvider';
import { friendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

type BusinessRegistration = {
  businessName: string;
  businessType: string;
  address: string;
  phone: string;
  district: string;
};

export function routeFor(ctx: AuthUser | null): Href {
  if (!ctx) return '/welcome';
  return ctx.businessId ? '/(tabs)' : '/onboarding/business';
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyErrorMessage(error));
}

export async function signUpWithPassword(
  user: { name: string; email: string; phone?: string },
  password: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: user.email,
    password,
    options: {
      data: {
        full_name: user.name,
        phone: user.phone ?? '',
      },
    },
  });
  if (error) throw new Error(friendlyErrorMessage(error));
  if (data.user?.identities?.length === 0) {
    throw new Error(friendlyErrorMessage({ message: 'User already registered' }));
  }
  return data.session !== null;
}

export async function loadAuthUser(user: User): Promise<AuthUser> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, phone, business_id, profile_code')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const businessId = typeof profile?.business_id === 'string' ? profile.business_id : null;
  let business: AuthUser['business'] = null;
  if (businessId) {
    const [businessResult, membershipResult] = await Promise.all([
      supabase
      .from('businesses')
      .select('name, business_code, business_type, address, district, phone, created_at, logo_path, receipt_header, receipt_footer, show_logo_on_receipt, notify_low_stock, currency_code')
      .eq('id', businessId)
      .maybeSingle(),
      supabase.from('business_members').select('role').eq('business_id', businessId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (businessResult.error) throw businessResult.error;
    if (membershipResult.error) throw membershipResult.error;
    const row = businessResult.data;
    business = row ? {
      id: businessId,
      name: typeof row.name === 'string' ? row.name : null,
      role: typeof membershipResult.data?.role === 'string' ? membershipResult.data.role : null,
      businessCode: typeof row.business_code === 'string' ? row.business_code : null,
      businessType: typeof row.business_type === 'string' ? row.business_type : null,
      address: typeof row.address === 'string' ? row.address : null,
      district: typeof row.district === 'string' ? row.district : null,
      phone: typeof row.phone === 'string' ? row.phone : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
      logoPath: typeof row.logo_path === 'string' ? row.logo_path : null,
      receiptHeader: typeof row.receipt_header === 'string' ? row.receipt_header : null,
      receiptFooter: typeof row.receipt_footer === 'string' ? row.receipt_footer : null,
      showLogoOnReceipt: row.show_logo_on_receipt === true,
      notifyLowStock: row.notify_low_stock === true,
      currencyCode: typeof row.currency_code === 'string' ? row.currency_code : null,
    } : null;
  }

  const { data: admin, error: adminError } = await supabase
    .from('platform_admins')
    .select('level')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminError) throw adminError;
  const metadataName = user.user_metadata.full_name;
  const profileName = profile?.full_name;
  const metadataPhone = user.user_metadata.phone;
  const businessName = business?.name ?? null;
  return {
    id: user.id,
    name: typeof profileName === 'string'
      ? profileName
      : typeof metadataName === 'string' ? metadataName : '',
    email: user.email ?? '',
    phone: typeof profile?.phone === 'string'
      ? profile.phone
      : typeof metadataPhone === 'string' ? metadataPhone : undefined,
    profileCode: typeof profile?.profile_code === 'string' ? profile.profile_code : null,
    businessId,
    businessName,
    businessCode: business?.businessCode ?? null,
    platformAdminLevel: typeof admin?.level === 'string' ? admin.level : null,
    business,
  };
}

export async function createBusiness(input: BusinessRegistration): Promise<void> {
  const { error } = await supabase.rpc('create_business', {
    p_business_name: input.businessName,
    p_business_type: input.businessType,
    p_phone: input.phone,
    p_address: input.address,
    p_district: input.district,
  });
  if (error) throw new Error(friendlyErrorMessage(error));
}
