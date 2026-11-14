import { useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';

import { Button, Field, Screen } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { routeFor } from '@/services/authService';
import { LegalLinks } from '@/components/LegalLinks';

const validEmail = /^\S+@\S+\.\S+$/;

export default function Login() {
  const { signIn, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail.test(normalizedEmail) || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      await signIn(normalizedEmail, password);
      const user = await refresh();
      router.replace(routeFor(user));
    } catch (loginError) {
      setError(friendlyErrorMessage(loginError));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <Screen back brand title="Welcome back" subtitle="Log in to see how your business is doing today."
      footer={
        <>
          {!!error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
          <Button label="Log in" onPress={submit} loading={loading} disabled={loading} />
          <Pressable onPress={() => router.replace('/signup')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text></Text>
          </Pressable>
        </>
      }
    >
      <Field label="Email" icon={Mail} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" icon={Lock} value={password} onChangeText={setPassword} placeholder="Your password" secure />
      <Pressable onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Text>
      </Pressable>
      <LegalLinks centered />
    </Screen>
  );
}
