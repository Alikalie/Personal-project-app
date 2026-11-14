import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check, CircleCheck, Lock, Mail, Phone, User } from 'lucide-react-native';

import { Button, Field, Screen } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { onboarding } from '@/services/onboardingStore';

const validEmail = /^\S+@\S+\.\S+$/;

export default function SignUp() {
  const { signUp, refresh } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [result, setResult] = useState<'success' | 'confirmation' | null>(null);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: Record<string, string> = {};
    if (trimmedName.length < 2) nextErrors.name = 'Enter your full name (at least 2 characters).';
    if (phone.replace(/\D/g, '').length < 8) nextErrors.phone = 'Enter a phone number with at least 8 digits.';
    if (!validEmail.test(normalizedEmail)) nextErrors.email = 'Enter a valid email address.';
    if (password.length < 6) nextErrors.password = 'Use a password with at least 6 characters.';
    if (!acceptedLegal) nextErrors.legal = 'Agree to the Terms and Conditions and Privacy Policy to continue.';
    setErrors(nextErrors);
    setRequestError('');
    if (Object.keys(nextErrors).length > 0) return;

    submitting.current = true;
    setLoading(true);
    try {
      onboarding.ownerName = trimmedName;
      onboarding.phone = phone.trim();
      const hasSession = await signUp({
        name: trimmedName,
        email: normalizedEmail,
        phone: phone.trim(),
        profileCode: null,
        businessCode: null,
        platformAdminLevel: null,
      }, password, marketingConsent);
      setResult(hasSession ? 'success' : 'confirmation');
    } catch (error) {
      setRequestError(friendlyErrorMessage(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const continueToOnboarding = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setRequestError('');
    try {
      await refresh();
      router.replace('/onboarding/business');
    } catch (error) {
      setRequestError(friendlyErrorMessage(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <Screen brand title="Account created successfully" subtitle="Your account is ready to set up."
        footer={<Button label="Continue" onPress={continueToOnboarding} loading={loading} />}
      >
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <CircleCheck size={48} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 18, textAlign: 'center' }}>
            {name.trim()}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center' }}>
            Next, add your business details.
          </Text>
        </View>
        {!!requestError && <Text style={{ color: colors.danger, textAlign: 'center' }}>{requestError}</Text>}
      </Screen>
    );
  }

  if (result === 'confirmation') {
    return (
      <Screen brand title="Check your email" subtitle={`We sent a confirmation link to ${email.trim().toLowerCase()}.`}
        footer={<Button label="Go to login" onPress={() => router.replace('/login')} />}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 23 }}>
          Confirm your email address, then log in to continue setting up your business.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen back brand title="Create your account" subtitle="Start managing your business in minutes."
      footer={
        <>
          {!!requestError && <Text style={{ color: colors.danger, marginBottom: 12 }}>{requestError}</Text>}
          <Button label="Create account" onPress={submit} loading={loading} disabled={loading || !acceptedLegal} />
          {!acceptedLegal && !loading ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              Agree to the Terms and Conditions and Privacy Policy to continue.
            </Text>
          ) : null}
          <Pressable onPress={() => router.replace('/login')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>Already registered? <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text></Text>
          </Pressable>
        </>
      }
    >
      <Field label="Full name" icon={User} value={name} onChangeText={setName} placeholder="Your full name" error={errors.name} />
      <Field label="Phone number" icon={Phone} value={phone} onChangeText={setPhone} placeholder="+232 76 000000" keyboardType="phone-pad" error={errors.phone} />
      <Field label="Email" icon={Mail} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      <Field label="Password" icon={Lock} value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure error={errors.password} />
      <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <Pressable
          onPress={() => setAcceptedLegal((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityLabel="I agree to the Terms and Conditions and Privacy Policy"
          accessibilityState={{ checked: acceptedLegal }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: acceptedLegal ? colors.primary : colors.border,
            backgroundColor: acceptedLegal ? colors.primary : colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {acceptedLegal ? <Check size={17} color={colors.white} /> : null}
          </View>
        </Pressable>
        <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 }}>
          I agree to the{' '}
          <Text
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'terms' } })}
            style={{ color: colors.primaryDark, fontWeight: '700', textDecorationLine: 'underline' }}
          >
            Terms and Conditions
          </Text>
          {' '}and{' '}
          <Text
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'privacy' } })}
            style={{ color: colors.primaryDark, fontWeight: '700', textDecorationLine: 'underline' }}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <Pressable
          onPress={() => setMarketingConsent((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityLabel="I agree to receive optional MiShop product and business updates by email"
          accessibilityState={{ checked: marketingConsent }}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: marketingConsent ? colors.primary : colors.border,
            backgroundColor: marketingConsent ? colors.primary : colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {marketingConsent ? <Check size={17} color={colors.white} /> : null}
          </View>
        </Pressable>
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
          I agree to receive optional product and business updates by email. You can change this anytime in Email preferences.
        </Text>
      </View>
      <Text style={{ height: 8 }} />
    </Screen>
  );
}
