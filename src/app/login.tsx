import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';

import { Button, Field, Screen } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.');
      return;
    }
    setError('');
    signIn(email.trim());
    router.replace('/(tabs)');
  };

  return (
    <Screen back brand title="Welcome back" subtitle="Log in to see how your business is doing today."
      footer={
        <>
          <Button label="Log in" onPress={submit} />
          <Pressable onPress={() => router.replace('/signup')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text></Text>
          </Pressable>
        </>
      }
    >
      <Field label="Email" icon={Mail} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" icon={Lock} value={password} onChangeText={setPassword} placeholder="Your password" secure />
      {!!error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Pressable onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Text>
      </Pressable>
    </Screen>
  );
}
