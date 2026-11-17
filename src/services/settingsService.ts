import { safeLogger } from '@/lib/safeLogger';
import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

import { friendlyErrorMessage } from '@/lib/errors';
import { isValidPhoneNumber } from '@/lib/contactValidation';
import { isBusinessProfileLocked } from '@/lib/permissions';
import { passwordPolicyError } from '@/lib/passwordPolicy';
import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/uuid';

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
export type BusinessCurrencyUpdate = { currency_code: string };

const logoUrlCache = new Map<string, { url: string; expiresAt: number }>();

function settingError(error: unknown): Error {
  safeLogger.warn('Settings request failed', error);
  return new Error(friendlyErrorMessage(error));
}

async function assertBusinessProfileEditable(businessId: string): Promise<void> {
  const { data, error } = await supabase
    .from('businesses')
    .select('profile_edit_locked_until')
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.profile_edit_locked_until !== null && typeof data.profile_edit_locked_until !== 'string')) {
    throw new Error('Business profile edit status is unavailable. Apply the profile cooldown migration and try again.');
  }
  if (isBusinessProfileLocked(data.profile_edit_locked_until)) {
    const lockedUntil = typeof data.profile_edit_locked_until === 'string'
      ? Date.parse(data.profile_edit_locked_until)
      : Number.NaN;
    throw new Error(Number.isFinite(lockedUntil)
      ? `Business details and logo can next be edited on ${new Date(lockedUntil).toLocaleDateString()}.`
      : 'Business profile edit status is invalid. Contact support for changes.');
  }
}

export async function updateProfile(profileId: string, input: ProfileUpdate): Promise<void> {
  if (input.phone.trim() && !isValidPhoneNumber(input.phone)) {
    throw new Error('Enter a valid phone number with 8 to 15 digits, or leave it blank.');
  }
  try {
    const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
    if (error) throw error;
  } catch (error) {
    throw settingError(error);
  }
}

export async function updateBusiness(
  businessId: string,
  input: BusinessUpdate | ReceiptUpdate | BusinessCurrencyUpdate | { notify_low_stock: boolean },
): Promise<string | undefined> {
  try {
    if ('phone' in input && input.phone.trim() && !isValidPhoneNumber(input.phone)) {
      throw new Error('Enter a valid phone number with 8 to 15 digits.');
    }
    if ('name' in input) {
      await assertBusinessProfileEditable(businessId);
      const { data, error } = await supabase
        .from('businesses')
        .update(input)
        .eq('id', businessId)
        .select('profile_edit_locked_until')
        .maybeSingle();
      if (error) throw error;
      if (!data || typeof data.profile_edit_locked_until !== 'string') {
        throw new Error('The business profile cooldown could not be confirmed. Refresh and try again.');
      }
      return data.profile_edit_locked_until;
    }
    const { error } = await supabase.from('businesses').update(input).eq('id', businessId);
    if (error) throw error;
    return undefined;
  } catch (error) {
    throw settingError(error);
  }
}

export async function uploadBusinessLogo(
  businessId: string,
  asset: ImagePickerAsset,
  previousPath: string | null = null,
): Promise<{ path: string; profileEditLockedUntil: string }> {
  try {
    await assertBusinessProfileEditable(businessId);
    const manipulated = await ImageManipulator.manipulate(asset.uri, { maxWidth: 600, maxHeight: 600 });
    const rendered = await manipulated.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    const base64 = await new File(result.uri).base64();
    const path = `${businessId}/logo-${newId()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data, error: updateError } = await supabase
      .from('businesses')
      .update({ logo_path: path })
      .eq('id', businessId)
      .select('profile_edit_locked_until')
      .maybeSingle();
    if (updateError || !data || typeof data.profile_edit_locked_until !== 'string') {
      const { error: cleanupError } = await supabase.storage.from('product-images').remove([path]);
      if (cleanupError) safeLogger.warn('Unlinked business logo could not be removed', cleanupError);
      if (updateError) throw updateError;
      throw new Error('The business profile cooldown could not be confirmed. Refresh and try again.');
    }
    logoUrlCache.delete(path);
    if (previousPath && previousPath !== path) {
      const { error: previousLogoError } = await supabase.storage.from('product-images').remove([previousPath]);
      if (previousLogoError) {
        safeLogger.warn('Previous business logo could not be removed', previousLogoError);
      } else {
        logoUrlCache.delete(previousPath);
      }
    }
    return { path, profileEditLockedUntil: data.profile_edit_locked_until };
  } catch (error) {
    throw settingError(error);
  }
}

export async function removeBusinessLogo(businessId: string, path: string | null): Promise<string> {
  try {
    await assertBusinessProfileEditable(businessId);
    const { data, error } = await supabase
      .from('businesses')
      .update({ logo_path: null })
      .eq('id', businessId)
      .select('profile_edit_locked_until')
      .maybeSingle();
    if (error) throw error;
    if (!data || typeof data.profile_edit_locked_until !== 'string') {
      throw new Error('The business profile cooldown could not be confirmed. Refresh and try again.');
    }
    if (path) {
      const { error: removeError } = await supabase.storage.from('product-images').remove([path]);
      if (removeError) {
        safeLogger.warn('Unlinked business logo could not be removed', removeError);
      } else {
        logoUrlCache.delete(path);
      }
    }
    return data.profile_edit_locked_until;
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

export async function getLogoDataUri(path: string | null): Promise<string | null> {
  if (!path) return null;
  let downloadedUri: string | null = null;
  try {
    const url = await getLogoUrl(path);
    if (!url) return null;
    if (!LegacyFileSystem.cacheDirectory) throw new Error('The app cache is not available.');
    const extension = path.split('.').pop()?.toLowerCase();
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    const result = await LegacyFileSystem.downloadAsync(
      url,
      `${LegacyFileSystem.cacheDirectory}mishop-receipt-preview-${Date.now()}`,
    );
    downloadedUri = result.uri;
    const base64 = await LegacyFileSystem.readAsStringAsync(result.uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error('The business logo could not be read.');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw settingError(error);
  } finally {
    if (downloadedUri) {
      try {
        await LegacyFileSystem.deleteAsync(downloadedUri, { idempotent: true });
      } catch (error) {
        safeLogger.warn('Temporary receipt preview logo could not be removed:', error);
      }
    }
  }
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  const passwordError = passwordPolicyError(newPassword);
  if (passwordError) throw new Error(passwordError);
  try {
    const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
    if (currentUserError) throw currentUserError;
    const currentUser = currentUserData.user;
    if (!currentUser.email) throw new Error('Your signed-in email is not available.');

    const { data: verifiedSession, error: verificationError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });
    if (verificationError || verifiedSession.user?.id !== currentUser.id) {
      safeLogger.warn('Password change reauthentication failed.');
      throw new Error('Your current password is incorrect.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
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
