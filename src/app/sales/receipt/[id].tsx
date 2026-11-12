import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';

import { ReceiptActions } from '@/components/receipts/ReceiptActions';
import { EmptyState, ScreenHeader, Skeleton } from '@/components/ds';
import { colors, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { buildSaleReceiptFromReceiptData } from '@/lib/receipt/buildReceiptData';
import { loadReceiptData, saveReceiptData } from '@/lib/receipt/receiptStore';
import type { ReceiptData } from '@/lib/receipt/types';
import { getReceiptData } from '@/services/salesService';

export default function SaleReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('This receipt is not available.');
      return;
    }
    setLoading(true);
    setError('');
    let cachedReceipt: ReceiptData | null = null;
    try {
      const cached = await loadReceiptData(`sale/${id}`);
      if (cached?.kind === 'sale') {
        cachedReceipt = cached;
        setData(cachedReceipt);
        setLoading(false);
      }
      const source = await getReceiptData(id);
      const receipt = buildSaleReceiptFromReceiptData(source);
      await saveReceiptData(`sale/${id}`, receipt);
      setData(receipt);
    } catch (loadError) {
      console.warn('Could not load receipt:', loadError);
      if (!cachedReceipt) setError(friendlyErrorMessage(loadError, 'receipt'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Receipt" onBack={() => router.back()} />
        {loading ? (
          <View style={styles.loading}>
            <Skeleton height={84} radius={14} />
            <Skeleton height={260} radius={14} />
          </View>
        ) : error || !data ? (
          <EmptyState
            icon={FileText}
            title="Receipt unavailable"
            message={error || 'This receipt could not be loaded.'}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.intro}>Receipt {data.receiptNo}</Text>
            <ReceiptActions data={data} cacheKey={`sale/${id}`} autoGenerate />
            <Pressable onPress={() => router.back()} style={styles.done} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  loading: { gap: Spacing.three, marginTop: Spacing.four },
  scroll: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: 28 },
  intro: { color: colors.textSecondary, ...typography.caption },
  done: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.textSecondary, ...typography.label },
});
