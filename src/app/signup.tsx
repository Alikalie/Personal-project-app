import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { Lock, Mail, Phone, User } from 'lucide-react-native';

import { Button, Field, Screen } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { onboarding } from '@/services/onboardingStore';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name.';
    if (phone.replace(/\D/g, '').length < 8) nextErrors.phone = 'Enter a valid phone number.';
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (password.length < 6) nextErrors.password = 'Use at least 6 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onboarding.ownerName = name.trim();
    onboarding.phone = phone.trim();
    signUp({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    router.replace('/(tabs)');
  };

  return (
    <Screen back brand title="Create your account" subtitle="Start managing your business in minutes."
      footer={
        <>
          <Button label="Create account" onPress={submit} />
          <Pressable onPress={() => router.replace('/login')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>Already registered? <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text></Text>
          </Pressable>
        </>
      }
    >
      <Field label="Full name" icon={User} value={name} onChangeText={setName} placeholder="Aminata Kamara" error={errors.name} />
      <Field label="Phone number" icon={Phone} value={phone} onChangeText={setPhone} placeholder="+232 76 000000" keyboardType="phone-pad" error={errors.phone} />
      <Field label="Email" icon={Mail} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      <Field label="Password" icon={Lock} value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure error={errors.password} />
      <Text style={{ height: 8 }} />
    </Screen>
  );
}
