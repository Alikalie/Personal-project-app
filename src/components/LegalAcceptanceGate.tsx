import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { signOut } from '@/services/settingsService';
import {
  acceptPublishedLegalDocuments,
  getPublishedLegalDocument,
  getRequiredLegalAcceptance,
  hasPreviouslyAcceptedLegal,
  rememberCurrentLegalAccepted,
  type RequiredLegalAcceptance,
} from '@/services/legalService';

type AcceptanceItem = RequiredLegalAcceptance & { changeSummary: string | null };

export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const { ctx, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [required, setRequired] = useState<AcceptanceItem[]>([]);
  const [error, setError] = useState('');
  const [checkFailed, setCheckFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const currentUser = useRef<string | null>(null);

  const checkAcceptance = useCallback(async (userId: string) => {
    setChecked(false);
    setError('');
    setCheckFailed(false);
    try {
      const needsAcceptance = await getRequiredLegalAcceptance();
      if (needsAcceptance.length === 0) await rememberCurrentLegalAccepted(userId);
      const details = await Promise.all(needsAcceptance.map(async (item) => {
        try {
          const published = await getPublishedLegalDocument(item.doc_type);
          return { ...item, changeSummary: published.document.change_summary };
        } catch (documentError) {
          console.warn('Legal change summary could not be loaded:', documentError);
          return { ...item, changeSummary: null };
        }
      }));
      setRequired(details);
    } catch (checkError) {
      console.warn('Legal acceptance check failed:', checkError);
      if (await hasPreviouslyAcceptedLegal(userId)) {
        setRequired([]);
      } else {
        setCheckFailed(true);
        setError(friendlyErrorMessage(checkError));
      }
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const userId = ctx?.id ?? null;
    if (!userId) {
      currentUser.current = null;
      setRequired([]);
      setChecked(true);
      setError('');
      return;
    }
    if (currentUser.current === userId) return;
    currentUser.current = userId;
    void checkAcceptance(userId);
  }, [checkAcceptance, ctx?.id, loading]);

  const retry = useCallback(() => {
    if (ctx?.id) void checkAcceptance(ctx.id);
  }, [checkAcceptance, ctx?.id]);

  const accept = async () => {
    if (!ctx?.id || saving || required.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await acceptPublishedLegalDocuments(Constants.expoConfig?.version ?? '1.0.0', ctx.id);
      setRequired([]);
    } catch (acceptError) {
      console.warn('Legal acceptance could not be saved:', acceptError);
      setError(friendlyErrorMessage(acceptError));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await signOut();
      router.replace('/welcome');
    } catch (logoutError) {
      console.warn('Could not log out from the legal acceptance screen:', logoutError);
      setError(friendlyErrorMessage(logoutError));
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading || !checked) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.stateText}>Checking current terms…</Text>
      </View>
    );
  }
  if (!ctx) return children;
  if (checkFailed) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>We couldn’t verify the current terms</Text>
          <Text style={styles.intro}>Connect to the internet and try again before continuing.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Try again" onPress={retry} />
          <Pressable onPress={() => void logout()} disabled={loggingOut} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
  if (required.length === 0) return children;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>We’ve updated our terms</Text>
        <Text style={styles.intro}>Please review and accept the current documents to continue using MiShop.</Text>
        {required.map((item) => (
          <View key={item.doc_type} style={styles.item}>
            <Text style={styles.itemTitle}>{item.title} · Version {item.version}</Text>
            <Text style={styles.summary}>{item.changeSummary || 'A new version is available.'}</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/legal/[type]', params: { type: item.doc_type } })}
              style={styles.linkTarget}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Read {item.title}</Text>
            </Pressable>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="I agree and continue" onPress={() => void accept()} loading={saving} disabled={saving} />
        {error ? (
          <Pressable onPress={retry} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryText}>Try again</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void logout()} disabled={loggingOut} style={styles.secondaryButton} accessibilityRole="button">
          <Text style={styles.secondaryText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.three },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, backgroundColor: colors.background },
  stateText: { color: colors.textSecondary, ...typography.body },
  title: { color: colors.text, ...typography.title },
  intro: { color: colors.textSecondary, ...typography.body },
  item: { paddingVertical: Spacing.three, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemTitle: { color: colors.text, ...typography.label },
  summary: { color: colors.textSecondary, ...typography.body, marginTop: Spacing.two },
  linkTarget: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.primaryDark, ...typography.label, textDecorationLine: 'underline' },
  error: { color: colors.danger, ...typography.caption },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textSecondary, ...typography.label },
});
