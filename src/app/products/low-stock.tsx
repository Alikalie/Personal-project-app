import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Boxes } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { listLowStock, type Product } from '@/services/productService';

export default function LowStock() {
  const { ctx } = useAuth();
  const canWrite = ['owner', 'manager'].includes(ctx?.business?.role?.toLowerCase() ?? '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ctx?.businessId) {
      setLoading(false);
      setError('Your business is not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setProducts(await listLowStock(ctx.businessId));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ctx?.businessId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}><ScreenHeader title="Low stock" subtitle="Products to restock" onBack={() => router.back()} /></View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading low-stock products...</Text></View>
      ) : error ? (
        <View style={styles.state}><Text style={styles.error}>{error}</Text><View style={{ width: '100%', maxWidth: 300, marginTop: 16 }}><Button label="Try again" onPress={() => void load()} /></View></View>
      ) : products.length === 0 ? (
        <View style={styles.state}><Text style={styles.emptyTitle}>All products are sufficiently stocked</Text><Text style={styles.subtitle}>Low-stock alerts will appear here.</Text></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={() => void load()}
          refreshing={loading}
          renderItem={({ item }) => <LowStockRow item={item} canWrite={canWrite} />}
        />
      )}
    </SafeAreaView>
  );
}

function LowStockRow({ item, canWrite }: { item: Product; canWrite: boolean }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} style={styles.rowMain} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.quantity} left, restock at ${item.low_stock_threshold}`}>
        <View style={styles.productImage}>
          {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Boxes size={25} color={colors.primary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.quantity}>{item.quantity} left · Restock at {item.low_stock_threshold}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: '/products/adjust', params: { id: item.id, type: 'stock_in' } })}
        disabled={!canWrite}
        style={[styles.stockButton, !canWrite && { opacity: 0.45 }]}
        accessibilityRole="button"
        accessibilityLabel={`Stock in ${item.name}`}
        accessibilityState={{ disabled: !canWrite }}
      >
        <Text style={styles.stockButtonText}>Stock in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  subtitle: { color: colors.textSecondary, marginTop: 5, textAlign: 'center', lineHeight: 21, fontSize: 13 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: radius.lg, padding: 11 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  productImage: { width: 54, height: 54, backgroundColor: colors.primaryLight, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  quantity: { color: '#815000', fontSize: 12, fontWeight: '700', marginTop: 4 },
  stockButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.primaryLight, borderRadius: 12 },
  stockButtonText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, textAlign: 'center' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
