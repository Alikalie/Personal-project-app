import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type ProfileUpdate = { full_name: string; phone: string };
export type BusinessUpdate = {
  name: string;
  business_type: string;
  address: string;
  district: string;
  phone: string;
};
export type ReceiptUpdate = {
  receipt_header: string;
  receipt_footer: string;
  show_logo_on_receipt: boolean;
};

const logoUrlCache = new Map<string, { url: string; expiresAt: number }>();

function settingError(error: unknown): Error {
  console.warn('Settings request failed', error);
  return new Error(friendlyErrorMessage(error));
}

export async function updateProfile(profileId: string, input: ProfileUpdate): Promise<void> {
  try {
    const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export async function updateBusiness(businessId: string, input: BusinessUpdate | ReceiptUpdate | { notify_low_stock: boolean }): Promise<void> {
  try {
    const { error } = await supabase.from('businesses').update(input).eq('id', businessId);
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export async function uploadBusinessLogo(businessId: string, asset: ImagePickerAsset): Promise<string> {
  try {
    const manipulated = await ImageManipulator.manipulate(asset.uri, { maxWidth: 600, maxHeight: 600 });
    const rendered = await manipulated.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    const base64 = await new File(result.uri).base64();
    const path = `${businessId}/logo.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from('businesses').update({ logo_path: path }).eq('id', businessId);
    if (updateError) throw updateError;
    logoUrlCache.delete(path);
    return path;
  } catch (error) {
    throw settingError(error);
  }
}

export async function removeBusinessLogo(businessId: string, path: string | null): Promise<void> {
  try {
    if (path) {
      const { error: removeError } = await supabase.storage.from('product-images').remove([path]);
      if (removeError) throw removeError;
      logoUrlCache.delete(path);
    }
    const { error } = await supabase.from('businesses').update({ logo_path: null }).eq('id', businessId);
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export async function getLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const cached = logoUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  try {
    const { data, error } = await supabase.storage.from('product-images').createSignedUrl(path, 60 * 60);
    if (error) throw error;
    logoUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
    return data.signedUrl;
  } catch (error) {
    throw settingError(error);
  }
}

export async function updatePassword(password: string): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export function clearSettingsCaches() {
  logoUrlCache.clear();
}
