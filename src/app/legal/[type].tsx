import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { MarkdownView } from '@/components/MarkdownView';
import { colors, Spacing, typography } from '@/constants/theme';
import {
  getPublishedLegalDocument,
  type LegalDocument,
  type LegalDocumentType,
} from '@/services/legalService';

function displayDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'long',
  }).format(date);
}

export default function LegalDocumentScreen() {
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const type: LegalDocumentType | null = rawType === 'privacy' || rawType === 'terms' ? rawType : null;
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!type) {
      setLoading(false);
      setError('This legal document is not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPublishedLegalDocument(type);
      setDocument(result.document);
      setOffline(result.offline);
    } catch (loadError) {
      console.warn('Legal document could not be loaded:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load this document.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{document?.title ?? (type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions')}</Text>
      </View>
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading document…</Text>
        </View>
      ) : error && !document ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : document ? (
        <ScrollView contentContainerStyle={styles.content}>
          {offline ? <Text style={styles.offline}>Offline copy</Text> : null}
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.meta}>Version {document.version}, effective {displayDate(document.effective_date)}</Text>
          <MarkdownView>{document.body_md}</MarkdownView>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: Spacing.two, paddingHorizontal: Spacing.five },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, ...typography.heading },
  content: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.seven },
  offline: { color: colors.textSecondary, ...typography.caption, marginBottom: Spacing.two },
  title: { color: colors.text, ...typography.title, marginBottom: Spacing.two },
  meta: { color: colors.textSecondary, ...typography.caption, marginBottom: Spacing.four },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  stateText: { color: colors.textSecondary, ...typography.body, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  retryText: { color: colors.primaryDark, ...typography.label },
});
