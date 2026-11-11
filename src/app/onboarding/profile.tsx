import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MapPin, Phone } from 'lucide-react-native';

import { Button, Field, Screen, StepDots } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { createBusiness, routeFor } from '@/services/authService';
import { clearOnboarding, onboarding } from '@/services/onboardingStore';

const districts = ['Western Area Urban', 'Western Area Rural', 'Bo', 'Kenema', 'Makeni', 'Other'];

export default function BusinessProfile() {
  const { refresh } = useAuth();
  const [address, setAddress] = useState(onboarding.address);
  const [phone, setPhone] = useState(onboarding.phone);
  const [district, setDistrict] = useState(onboarding.district);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  const finish = async () => {
    if (loading) return;
    Object.assign(onboarding, { address: address.trim(), phone: phone.trim(), district });
    setLoading(true);
    setError('');
    try {
      if (!created) {
        await createBusiness(onboarding);
        setCreated(true);
        clearOnboarding();
      }
      const user = await refresh();
      if (!user?.businessId) throw new Error('Your business was created, but the profile is not ready yet. Please try again.');
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
      <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.primaryLight }}>
        <Text style={{ fontSize: 13, color: colors.primaryDark }}>Currency: New Leone (SLE). You can change receipt details later in Settings.</Text>
      </View>
    </Screen>
  );
}
