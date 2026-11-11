import { router, usePreventRemove } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useRef, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, minTouchTarget, Spacing, typography } from '@/constants/theme';

export function SettingsPage({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function useUnsavedChanges(isDirty: boolean) {
  const disableRef = useRef<() => void>(() => undefined);
  const onPreventRemove = useCallback(({ repeat }: { repeat: () => void }) => {
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          disableRef.current();
          repeat();
        },
      },
    ]);
  }, []);
  const disablePrevention = usePreventRemove(isDirty, onPreventRemove);
  disableRef.current = disablePrevention;
  return disablePrevention;
}

export function InfoMessage({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'danger' | 'success' }) {
  const color = tone === 'danger' ? colors.danger : tone === 'success' ? colors.primaryDark : colors.textSecondary;
  return <Text accessibilityRole="text" style={[styles.message, { color }]}>{children}</Text>;
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 40, gap: Spacing.three },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.two, backgroundColor: colors.background },
  back: { width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.white },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  section: { gap: Spacing.three, marginTop: Spacing.three },
  sectionTitle: { color: colors.text, ...typography.heading },
  message: { ...typography.caption, lineHeight: 18 },
});
