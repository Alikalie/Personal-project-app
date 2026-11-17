import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { ContactInfoHint } from '@/components/ContactInfoHint';
import { Badge, Card } from '@/components/ds';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { isValidPhoneNumber } from '@/lib/contactValidation';
import { canEditBusiness, canEditBusinessProfile, isBusinessProfileLocked } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { getLogoUrl, removeBusinessLogo, updateBusiness, uploadBusinessLogo } from '@/services/settingsService';

const businessTypes = ['Retail shop', 'Boutique', 'Supermarket', 'Pharmacy', 'Electronics', 'Food & drinks', 'Hardware', 'Other'];

export default function BusinessSettings() {
  const { ctx, updateBusinessContext } = useAuth();
  const { required } = useLocalSearchParams<{ required?: string }>();
  const [now, setNow] = useState(0);
  const profileRequired = required === 'true';
  const business = ctx?.business;
  const canManageBusiness = canEditBusiness(business?.role);
  const hasProfileLockStatus = Boolean(
    business && (business.profileEditLockedUntil === null || typeof business.profileEditLockedUntil === 'string'),
  );
  const profileLocked = isBusinessProfileLocked(business?.profileEditLockedUntil, now);
  const profileLockDate = typeof business?.profileEditLockedUntil === 'string'
    ? Date.parse(business.profileEditLockedUntil)
    : Number.NaN;
  const editable = hasProfileLockStatus
    && canEditBusinessProfile(business?.role, business?.profileEditLockedUntil, now);
  const [name, setName] = useState(business?.name ?? '');
  const [type, setType] = useState(business?.businessType ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  const [district, setDistrict] = useState(business?.district ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [logoPath, setLogoPath] = useState<string | null>(business?.logoPath ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState('');
  const original = useMemo(() => ({
    name: business?.name ?? '',
    type: business?.businessType ?? '',
    address: business?.address ?? '',
    district: business?.district ?? '',
    phone: business?.phone ?? '',
  }), [business]);
  const dirty = name !== original.name || type !== original.type || address !== original.address || district !== original.district || phone !== original.phone;
  const disablePrevention = useUnsavedChanges(dirty);

  useEffect(() => {
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshLock = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (typeof business?.profileEditLockedUntil !== 'string') return;
      const remaining = Date.parse(business.profileEditLockedUntil) - currentTime;
      if (Number.isFinite(remaining) && remaining > 0) {
        unlockTimer = setTimeout(refreshLock, remaining);
      }
    };
    const initialTimer = setTimeout(refreshLock, 0);
    return () => {
      clearTimeout(initialTimer);
      if (unlockTimer) clearTimeout(unlockTimer);
    };
  }, [business?.profileEditLockedUntil]);

  useEffect(() => {
    setName(business?.name ?? '');
    setType(business?.businessType ?? '');
    setAddress(business?.address ?? '');
    setDistrict(business?.district ?? '');
    setPhone(business?.phone ?? '');
  }, [
    business?.address,
    business?.businessType,
    business?.district,
    business?.name,
    business?.phone,
  ]);

  useEffect(() => {
    setLogoPath(business?.logoPath ?? null);
  }, [business?.logoPath]);

  useEffect(() => {
    let active = true;
    void getLogoUrl(logoPath).then((url) => {
      if (active) setLogoUrl(url);
    }).catch((loadError: unknown) => {
      if (active) setError(friendlyErrorMessage(loadError));
    });
    return () => { active = false; };
  }, [logoPath]);

  const save = async () => {
    if (!ctx?.businessId) return setError('Business details are not available.');
    if (name.trim().length < 2) return setError('Business name must be at least 2 characters.');
    if (!type.trim()) return setError('Choose a business type.');
    if (!address.trim()) return setError('Enter the business address.');
    if (!district.trim()) return setError('Enter the business district.');
    if (!isValidPhoneNumber(phone)) return setError('Enter a valid phone number with 8 to 15 digits.');
    setSaving(true);
    setError('');
    try {
      const profileEditLockedUntil = await updateBusiness(ctx.businessId, {
        name: name.trim(),
        business_type: type,
        address: address.trim(),
        district: district.trim(),
        phone: phone.trim(),
      });
      if (!profileEditLockedUntil) {
        throw new Error('The business profile cooldown could not be confirmed. Refresh and try again.');
      }
      updateBusinessContext({ profileEditLockedUntil });
      updateBusinessContext({
        name: name.trim(),
        businessType: type,
        address: address.trim(),
        district: district.trim(),
        phone: phone.trim(),
      });
      disablePrevention();
      if (profileRequired) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Business updated', 'Your profile is saved. Details and logo are now locked for 7 days.');
      }
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async (camera: boolean) => {
    if (!ctx?.businessId) return setError('Business details are not available.');
    setError('');
    setLogoBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Allow camera access to take a business logo photo.');
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Allow photo access to choose a business logo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const { path, profileEditLockedUntil } = await uploadBusinessLogo(ctx.businessId, asset, logoPath);
      updateBusinessContext({ logoPath: path, profileEditLockedUntil });
      setLogoPath(path);
      setLogoUrl(await getLogoUrl(path));
      Alert.alert('Logo updated', 'Your business logo has been saved. Profile details are now locked for 7 days.');
    } catch (pickError) {
      setError(friendlyErrorMessage(pickError));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = () => {
    if (!ctx?.businessId) return;
    Alert.alert('Remove business logo?', 'The logo will no longer appear in your business profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setLogoBusy(true);
          void removeBusinessLogo(ctx.businessId!, logoPath).then((profileEditLockedUntil) => {
            updateBusinessContext({ logoPath: null, profileEditLockedUntil });
            setLogoPath(null);
            setLogoUrl(null);
            Alert.alert('Logo removed', 'Profile details are now locked for 7 days.');
          }).catch((removeError: unknown) => setError(friendlyErrorMessage(removeError)))
            .finally(() => setLogoBusy(false));
        },
      },
    ]);
  };

  return (
    <SettingsPage
      title="Business profile"
      subtitle={profileRequired
        ? 'Complete your business profile to unlock the rest of the app.'
        : !canManageBusiness
          ? 'Only owners and managers can edit business details.'
          : !hasProfileLockStatus
            ? 'Business profile edit status is unavailable. Contact support.'
            : profileLocked && Number.isFinite(profileLockDate)
              ? `Business details and logo are locked until ${new Date(profileLockDate).toLocaleDateString()}.`
              : profileLocked
                ? 'Business profile edit status is unavailable. Contact support.'
          : editable
            ? 'After saving, business details and logo will be locked for 7 days.'
            : 'Business profile details and logo are read-only.'}
      footer={editable ? <Button label={profileRequired ? 'Save and continue' : 'Save changes'} onPress={() => void save()} loading={saving} disabled={saving || (!dirty && !profileRequired)} /> : undefined}
    >
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.text, ...typography.heading }}>{business?.name ?? 'Business'}</Text>
        <Text style={{ color: colors.textSecondary }}>ID: {ctx?.businessCode ?? 'Not available'}</Text>
        <Text style={{ color: colors.textSecondary }}>Type: {business?.businessType ?? 'Not set'}</Text>
        <Text style={{ color: colors.textSecondary }}>Created: {business?.createdAt ? new Date(business.createdAt).toLocaleDateString() : 'Not available'}</Text>
      </Card>
      {!editable ? (
        <InfoMessage>
          {!canManageBusiness
            ? 'Only owners and managers can edit business details.'
            : !hasProfileLockStatus
              ? 'Business profile edit status is unavailable. Apply the profile cooldown migration or contact support.'
              : profileLocked && Number.isFinite(profileLockDate)
                ? `Business details and logo can next be edited on ${new Date(profileLockDate).toLocaleDateString()}.`
                : 'Business profile edit status is invalid. Contact support for changes.'}
        </InfoMessage>
      ) : null}
      <Field label="Business name" value={name} onChangeText={setName} editable={editable} />
      <Text style={{ color: colors.text, ...typography.label }}>Business type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {businessTypes.map((option) => (
          <Pressable key={option} disabled={!editable} onPress={() => setType(option)} accessibilityRole="button" accessibilityState={{ selected: type === option, disabled: !editable }} style={{
            borderRadius: radius.xl, borderWidth: 1, borderColor: type === option ? colors.primary : colors.border,
            backgroundColor: type === option ? colors.primaryLight : colors.white, minHeight: 48, paddingHorizontal: 12, justifyContent: 'center',
          }}>
            <Text style={{ color: type === option ? colors.primaryDark : colors.textSecondary, ...typography.caption }}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Address" value={address} onChangeText={setAddress} editable={editable} />
      <Field label="District" value={district} onChangeText={setDistrict} editable={editable} />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={editable} />
      <ContactInfoHint>
        Enter a working phone number with your country code so customers and support can reach your business.
      </ContactInfoHint>
      <Card style={{ gap: Spacing.three, alignItems: 'center' }}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 120, height: 120, borderRadius: radius.md }} contentFit="contain" accessibilityLabel="Business logo preview" /> : <Text style={{ color: colors.textSecondary }}>No business logo uploaded</Text>}
        {editable ? (
          <>
            <View style={{ width: '100%' }}><Button label="Choose from gallery" variant="outline" onPress={() => void pickLogo(false)} loading={logoBusy} /></View>
            <View style={{ width: '100%' }}><Button label="Take a photo" variant="outline" onPress={() => void pickLogo(true)} loading={logoBusy} /></View>
            {logoPath ? <Button label="Remove logo" variant="outline" onPress={removeLogo} disabled={logoBusy} /> : null}
          </>
        ) : null}
      </Card>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
      {business?.role ? <Badge label={business.role} tone="neutral" /> : null}
    </SettingsPage>
  );
}
