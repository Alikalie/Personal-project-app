import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Camera, MapPin } from 'lucide-react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import { Button, Field, Screen, StepDots } from '@/components/ui';
import { CurrencyPicker } from '@/components/ui/CurrencyPicker';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius, typography } from '@/constants/theme';
import { isValidPhoneNumber } from '@/lib/contactValidation';
import { friendlyErrorMessage } from '@/lib/errors';
import { createBusiness, routeFor } from '@/services/authService';
import { updateBusiness, uploadBusinessLogo } from '@/services/settingsService';
import { clearOnboarding, onboarding } from '@/services/onboardingStore';

const districts = ['Western Area Urban', 'Western Area Rural', 'Bo', 'Kenema', 'Makeni', 'Other'];

export default function BusinessProfile() {
  const { ctx, refresh, updateBusinessContext } = useAuth();
  const [address, setAddress] = useState(onboarding.address);
  const [district, setDistrict] = useState(onboarding.district);
  const [currencyCode, setCurrencyCode] = useState(onboarding.currencyCode);
  const [logoAsset, setLogoAsset] = useState<ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  const finish = async () => {
    if (loading || logoBusy) return;
    if (!address.trim()) return setError('Enter your business address.');
    if (!district.trim()) return setError('Choose your business district.');
    const phone = onboarding.phone.trim() || ctx?.phone?.trim() || '';
    if (!isValidPhoneNumber(phone)) return setError('A valid phone number with 8 to 15 digits is required. Update your account phone number and try again.');
    Object.assign(onboarding, { address: address.trim(), phone, district });
    onboarding.currencyCode = currencyCode;
    setLoading(true);
    setError('');
    try {
      if (!created) {
        await createBusiness(onboarding);
        setCreated(true);
      }
      const user = await refresh();
      if (!user?.businessId) throw new Error('Your business was created, but the profile is not ready yet. Please try again.');
      await updateBusiness(user.businessId, { currency_code: currencyCode });
      updateBusinessContext({ currencyCode });
      if (logoAsset) {
        const { path: logoPath, profileEditLockedUntil } = await uploadBusinessLogo(user.businessId, logoAsset);
        updateBusinessContext({ logoPath, profileEditLockedUntil });
      }
      clearOnboarding();
      router.replace(routeFor(user));
    } catch (finishError) {
      setError(friendlyErrorMessage(finishError));
    } finally {
      setLoading(false);
    }
  };

  const chooseLogo = async () => {
    setError('');
    setLogoBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo access to choose a business logo.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!result.canceled) setLogoAsset(result.assets[0]);
    } catch (pickError) {
      setError(friendlyErrorMessage(pickError));
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <Screen back title="Business profile" subtitle="Step 3 of 3. This appears on your receipts."
      footer={
        <>
          {!!error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
          <Button label="Finish setup" onPress={finish} loading={loading} disabled={loading || logoBusy} />
        </>
      }
    >
      <StepDots step={3} />
      <Field label="Shop address" icon={MapPin} value={address} onChangeText={setAddress} placeholder="e.g. 12 Fourah Bay Road, Freetown" />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>District</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {districts.map((d) => {
          const active = d === district;
          return (
            <Pressable key={d} onPress={() => setDistrict(d)} style={{
              minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primaryLight : colors.white,
            }} accessibilityRole="button" accessibilityLabel={d} accessibilityState={{ selected: active }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? colors.primaryDark : colors.textSecondary }}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.text, ...typography.label, marginBottom: 8 }}>Currency</Text>
      <CurrencyPicker value={currencyCode} onChange={setCurrencyCode} disabled={loading || logoBusy} compact />
      <Text style={{ color: colors.textSecondary, ...typography.caption, marginTop: 8, marginBottom: 20 }}>
        You can change this later in Settings.
      </Text>
      <Text style={{ color: colors.text, ...typography.label, marginBottom: 10 }}>Shop logo (optional)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => void chooseLogo()}
          disabled={loading || logoBusy}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.textSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          accessibilityRole="button"
          accessibilityLabel={logoAsset ? 'Change shop logo' : 'Choose a shop logo'}
        >
          {logoAsset
            ? <Image source={{ uri: logoAsset.uri }} style={{ width: 50, height: 50, borderRadius: 25 }} contentFit="cover" />
            : <Camera size={20} color={colors.textSecondary} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, ...typography.label }}>Add a logo for your receipts</Text>
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>Square photo works best</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
        <Pressable
          onPress={() => void chooseLogo()}
          disabled={loading || logoBusy}
          style={{ minHeight: 40, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center' }}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{logoBusy ? 'Choosing...' : 'Choose'}</Text>
        </Pressable>
        <Pressable onPress={() => setLogoAsset(null)} disabled={loading || logoBusy} accessibilityRole="button">
          <Text style={{ color: colors.textSecondary, ...typography.label }}>Skip for now</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
