import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { isPlatformAdmin } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

const idleTimeoutMs = 15 * 60_000;
const backgroundTimeoutMs = 5 * 60_000;

export default function AdminLayout() {
  const { ctx, loading } = useAuth();
  const allowed = isPlatformAdmin(ctx?.platformAdminLevel);

  useEffect(() => {
    if (!loading && !allowed) router.replace('/(tabs)');
  }, [allowed, loading]);

  if (loading || !allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <AdminProtection key={ctx.id}><Stack screenOptions={{ headerShown: false }} /></AdminProtection>;
}

function AdminProtection({ children }: { children: React.ReactNode }) {
  usePreventScreenCapture('mishop-admin');
  const [mfaChecking, setMfaChecking] = useState(true);
  const [requiredFactorId, setRequiredFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const lastActivity = useRef(Date.now());
  const backgroundedAt = useRef<number | null>(null);
  const logoutStarted = useRef(false);

  useEffect(() => {
    let active = true;
    const checkMfa = async () => {
      setMfaChecking(true);
      setError('');
      try {
        const [factorsResult, aalResult] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (factorsResult.error) throw factorsResult.error;
        if (aalResult.error) throw aalResult.error;
        const verifiedFactor = factorsResult.data.totp.find((factor) => factor.status === 'verified');
        if (active && verifiedFactor && aalResult.data.currentLevel !== 'aal2') {
          setRequiredFactorId(verifiedFactor.id);
        } else if (active) {
          setRequiredFactorId(null);
        }
      } catch (checkError) {
        if (active) setError(friendlyErrorMessage(checkError, 'admin'));
      } finally {
        if (active) setMfaChecking(false);
      }
    };
    void checkMfa();
    return () => { active = false; };
  }, []);

  const signOutForInactivity = async (reason: string) => {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    setSigningOut(true);
    setError(reason);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      const keys = await AsyncStorage.getAllKeys();
      const adminKeys = keys.filter((key) => key.startsWith('@mishop/admin/'));
      if (adminKeys.length) await AsyncStorage.multiRemove(adminKeys);
    } catch (signOutError) {
      logoutStarted.current = false;
      setSigningOut(false);
      setError(friendlyErrorMessage(signOutError, 'admin'));
      console.warn('Admin inactivity sign-out failed.');
    }
  };

  useEffect(() => {
    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivity.current >= idleTimeoutMs) {
        void signOutForInactivity('You were signed out after 15 minutes without activity.');
      }
    }, 30_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      const backgroundedTime = backgroundedAt.current;
      backgroundedAt.current = null;
      if (backgroundedTime !== null && Date.now() - backgroundedTime > backgroundTimeoutMs) {
        void signOutForInactivity('You were signed out because MiShop was in the background for more than 5 minutes.');
      } else {
        lastActivity.current = Date.now();
      }
    });
    return () => {
      clearInterval(idleTimer);
      appStateSubscription.remove();
    };
  }, []);

  const verifyMfa = async () => {
    if (!requiredFactorId || verifying || verificationCode.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: requiredFactorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: requiredFactorId,
        challengeId: challenge.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;
      setRequiredFactorId(null);
      setVerificationCode('');
      lastActivity.current = Date.now();
    } catch (verifyError) {
      setError(friendlyErrorMessage(verifyError, 'admin'));
    } finally {
      setVerifying(false);
    }
  };

  if (mfaChecking || signingOut) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{signingOut ? 'Signing out securely…' : 'Checking admin security…'}</Text>
      </View>
    );
  }

  if (error && !requiredFactorId) {
    return (
      <View style={styles.gate}>
        <Text style={styles.title}>Admin security check failed</Text>
        <Text style={styles.message}>{error}</Text>
        <Button label="Try again" onPress={() => router.replace('/admin')} />
      </View>
    );
  }

  if (requiredFactorId) {
    return (
      <View style={styles.gate}>
        <ScrollView contentContainerStyle={styles.gateContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.message}>Enter the 6-digit code from your authenticator app to continue to admin tools.</Text>
          <TextInput
            value={verificationCode}
            onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.codeInput}
            accessibilityLabel="Admin authenticator verification code"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Verify and continue" onPress={() => void verifyMfa()} loading={verifying} disabled={verifying || verificationCode.length !== 6} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.stack} onTouchStart={() => { lastActivity.current = Date.now(); }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, backgroundColor: colors.background },
  message: { color: colors.textSecondary, ...typography.body, textAlign: 'center' },
  gate: { flex: 1, justifyContent: 'center', padding: Spacing.five, backgroundColor: colors.background },
  gateContent: { flexGrow: 1, justifyContent: 'center', gap: Spacing.three },
  title: { color: colors.text, ...typography.title, textAlign: 'center' },
  codeInput: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: Spacing.three, backgroundColor: colors.white, color: colors.text, textAlign: 'center', letterSpacing: 4, fontSize: 20 },
  error: { color: colors.danger, ...typography.caption },
});
