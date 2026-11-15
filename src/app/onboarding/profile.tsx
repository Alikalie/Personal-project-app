import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MapPin, Phone } from 'lucide-react-native';

import { Button, Field, Screen, StepDots } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { supportedCurrencies } from '@/lib/currencies';
import { createBusiness, routeFor } from '@/services/authService';
import { updateBusiness } from '@/services/settingsService';
import { clearOnboarding, onboarding } from '@/services/onboardingStore';

const districts = ['Western Area Urban', 'Western Area Rural', 'Bo', 'Kenema', 'Makeni', 'Other'];

export default function BusinessProfile() {
  const { refresh, updateBusinessContext } = useAuth();
  const [address, setAddress] = useState(onboarding.address);
  const [phone, setPhone] = useState(onboarding.phone);
  const [district, setDistrict] = useState(onboarding.district);
  const [currencyCode, setCurrencyCode] = useState(onboarding.currencyCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  const finish = async () => {
    if (loading) return;
    if (!address.trim()) return setError('Enter your business address.');
    if (!district.trim()) return setError('Choose your business district.');
    if (phone.replace(/\D/g, '').length < 8) return setError('Enter a business phone number with at least 8 digits.');
    Object.assign(onboarding, { address: address.trim(), phone: phone.trim(), district });
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
      clearOnboarding();
      router.replace(routeFor(user));
    } catch (finishError) {
      setError(friendlyErrorMessage(finishError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen back title="Business profile" subtitle="Step 3 of 3. This appears on your receipts."
      footer={
        <>
          {!!error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
          <Button label="Finish setup" onPress={finish} loading={loading} disabled={loading} />
        </>
      }
    >
      <StepDots step={3} />
      <Field label="Shop address" icon={MapPin} value={address} onChangeText={setAddress} placeholder="e.g. 12 Fourah Bay Road, Freetown" />
      <Field label="Business phone" icon={Phone} value={phone} onChangeText={setPhone} placeholder="+232 76 000000" keyboardType="phone-pad" />
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
      <Text style={{ color: colors.text, ...typography.label }}>Choose your business currency</Text>
      <Text style={{ color: colors.textSecondary, ...typography.caption }}>
        Sierra Leonean Leone is selected by default. You can change this later in Settings.
      </Text>
      <View style={{ gap: Spacing.two, marginBottom: Spacing.three }}>
        {supportedCurrencies.map((currency) => {
          const active = currency.code === currencyCode;
          return (
            <Pressable
              key={currency.code}
              onPress={() => setCurrencyCode(currency.code)}
              style={{
                minHeight: 52,
                paddingHorizontal: Spacing.three,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primaryLight : colors.white,
                justifyContent: 'center',
              }}
              accessibilityRole="radio"
              accessibilityLabel={`${currency.name}, ${currency.code}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? colors.primaryDark : colors.text, ...typography.label }}>
                {currency.name} ({currency.code}){active ? '  ·  Selected' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
