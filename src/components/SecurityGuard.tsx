import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui';
import { colors, Spacing, typography } from '@/constants/theme';

const appLockKey = '@mishop/security/app-lock';
type SecurityContextValue = {
  appLockEnabled: boolean;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
};
const SecurityContext = createContext<SecurityContextValue | null>(null);

export function SecurityGuard({ children }: { children: ReactNode }) {
  usePreventScreenCapture('mishop');
  const { ctx, loading: authLoading } = useAuth();
  const [appLockEnabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(appLockKey).then((value) => {
      if (!active) return;
      setEnabled(value === 'true');
      setReady(true);
    }).catch(() => {
      if (!active) return;
      setError('Security preferences could not be loaded.');
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || authLoading) return;
    setLocked(Boolean(appLockEnabled && ctx));
  }, [appLockEnabled, authLoading, ctx, ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && appLockEnabled && ctx) setLocked(true);
    });
    return () => subscription.remove();
  }, [appLockEnabled, ctx]);

  const setAppLockEnabled = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(appLockKey, String(enabled));
    setEnabled(enabled);
    setLocked(Boolean(enabled && ctx));
  }, [ctx]);

  const unlock = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setUnlocking(true);
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MiShop',
        disableDeviceFallback: false,
      });
      if (!result.success) {
        setError(result.error === 'not_enrolled'
          ? 'Set up a device screen lock or biometrics to unlock MiShop.'
          : 'Authentication was not completed. Try again.');
        return;
      }
      setLocked(false);
    } catch {
      setError('Device authentication is unavailable. Try again or sign out.');
    } finally {
      setUnlocking(false);
      inFlight.current = false;
    }
  }, []);

  if (!ready || authLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>Preparing secure session…</Text>
      </View>
    );
  }

  return (
    <SecurityContext.Provider value={{ appLockEnabled, setAppLockEnabled }}>
      {locked ? (
        <View style={styles.state}>
          <Text style={styles.title}>MiShop is locked</Text>
          <Text style={styles.message}>Authenticate with your device to continue.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Unlock MiShop" onPress={() => void unlock()} loading={unlocking} disabled={unlocking} />
        </View>
      ) : error && !appLockEnabled ? (
        <View style={styles.state}>
          <Text style={styles.title}>Security preferences unavailable</Text>
          <Text style={styles.error}>{error}</Text>
          <Button label="Continue" onPress={() => setError('')} />
        </View>
      ) : children}
    </SecurityContext.Provider>
  );
}

export function useSecuritySettings() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecuritySettings must be used within SecurityGuard.');
  return context;
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: Spacing.three, padding: Spacing.five, backgroundColor: colors.background },
  title: { color: colors.text, ...typography.title, textAlign: 'center' },
  message: { color: colors.textSecondary, ...typography.body, textAlign: 'center' },
  error: { color: colors.danger, ...typography.caption, textAlign: 'center' },
});
