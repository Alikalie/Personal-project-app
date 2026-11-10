import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, Mail } from 'lucide-react-native';

import { Button, Field, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setSent(true);
  };

  if (sent) {
    return (
      <Screen back footer={<Button label="Back to log in" onPress={() => router.replace('/login')} />}>
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={44} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 20 }}>Check your email</Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            We sent a reset link to {email}. Open it to choose a new password.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen back title="Reset your password" subtitle="Enter your email and we will send you a link to reset it."
      footer={<Button label="Send reset link" onPress={submit} />}
    >
      <Field label="Email" icon={Mail} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={error} />
    </Screen>
  );
}
