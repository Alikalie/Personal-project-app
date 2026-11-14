import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius, shadow } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { getProduct, listMovements, type Product, type StockMovement } from '@/services/productService';

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ctx } = useAuth();
  const role = ctx?.business?.role?.toLowerCase();
  const canWrite = role === 'owner' || role === 'manager';
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [productData, movementData] = await Promise.all([
        getProduct(id),
        listMovements(ctx?.businessId ?? '', { productId: id, pageSize: 20 }),
      ]);
      setProduct(productData);
      setMovements(movementData.rows);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ctx?.businessId, id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (loading) return <StateView loading message="Loading product..." />;
  if (error || !product) {
    return <StateView message={error || 'Product not found.'} onRetry={() => void load()} />;
  }

  const margin = product.selling_price_minor === 0
    ? '—'
    : `${Math.floor(((product.selling_price_minor - product.cost_price_minor) * 10000) / product.selling_price_minor) / 100}%`;
  const stockValue = product.quantity * product.cost_price_minor;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenHeader title="Product details" onBack={() => router.back()} />
        <View style={styles.hero}>
          <View style={styles.placeholder}>
            <ProductImage imageUrl={product.image_url} style={styles.productImage} />
          </View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.category}>{product.category_name ?? 'Uncategorised'}</Text>
        </View>

        <View style={styles.actions}>
          <Action primary icon={ArrowDownLeft} label="Stock in" disabled={!canWrite} onPress={() => router.push({ pathname: '/products/adjust', params: { id: product.id, type: 'stock_in' } })} />
          <Action icon={ArrowUpRight} label="Stock out" disabled={!canWrite} onPress={() => router.push({ pathname: '/products/adjust', params: { id: product.id, type: 'stock_out' } })} />
          <Action icon={Pencil} label="Edit" disabled={!canWrite} onPress={() => router.push({ pathname: '/products/edit/[id]', params: { id: product.id } })} />
        </View>
        {!canWrite && <Text style={styles.readOnly}>You have read-only stock access.</Text>}

        <View style={styles.quantityCard}>
          <Text style={styles.quantityLabel}>Current quantity</Text>
          <Text style={styles.quantityValue}>{product.quantity}</Text>
        </View>
        <View style={styles.card}>
          <DataRow label="Selling price" value={formatSLE(product.selling_price_minor)} />
          {canWrite ? <DataRow label="Purchase price" value={formatSLE(product.cost_price_minor)} last /> : null}
        </View>
        {canWrite ? <Text style={styles.marginText}>Estimated margin: {margin}</Text> : null}

        <Pressable
          onPress={() => setShowMoreDetails((value) => !value)}
          style={styles.moreDetails}
          accessibilityRole="button"
          accessibilityState={{ expanded: showMoreDetails }}
          accessibilityLabel={showMoreDetails ? 'Hide more product details' : 'Show more product details'}
        >
          <Text style={styles.section}>More details</Text>
          {showMoreDetails ? <ChevronUp size={20} color={colors.primaryDark} /> : <ChevronDown size={20} color={colors.primaryDark} />}
        </Pressable>
        {showMoreDetails ? (
          <View style={styles.card}>
            <DataRow label="Product code" value={product.sku || '—'} />
            <DataRow label="Barcode" value={product.barcode || '—'} />
            <DataRow label="Low-stock threshold" value={String(product.low_stock_threshold)} last={!canWrite} />
            {canWrite ? <DataRow label="Stock value at cost" value={formatSLE(stockValue)} last /> : null}
          </View>
        ) : null}

        <View style={styles.movementHeader}>
          <Text style={styles.section}>Recent stock movements</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/products/movements', params: { productId: product.id } })}
            style={styles.viewAll}
            accessibilityRole="button"
          >
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        {movements.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>No stock movements yet.</Text></View>
        ) : movements.slice(0, 5).map((movement) => <MovementRow key={movement.id} item={movement} />)}

        {canWrite && (
          <Pressable
            onPress={() => router.push({ pathname: '/products/adjust', params: { id: product.id, type: 'adjustment' } })}
            style={styles.adjustLink}
            accessibilityRole="button"
          >
            <Plus size={18} color={colors.primary} /><Text style={styles.link}>Make a stock adjustment</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon: Icon, label, disabled, onPress, primary = false }: { icon: typeof Pencil; label: string; disabled: boolean; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, primary && styles.primaryAction, disabled && { opacity: 0.45 }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <Icon size={20} color={primary ? colors.white : colors.primary} />
      <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>
    </Pressable>
  );
}

function DataRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.dataRow, !last && styles.rowBorder]}><Text style={styles.dataLabel}>{label}</Text><Text style={styles.dataValue}>{value}</Text></View>;
}

function MovementRow({ item }: { item: StockMovement }) {
  const inbound = item.quantity_change > 0;
  return (
    <View style={styles.movement}>
      <View style={[styles.movementIcon, { backgroundColor: inbound ? colors.primaryLight : '#FFF3E0' }]}>
        {inbound ? <ArrowDownLeft size={18} color={colors.primary} /> : <ArrowUpRight size={18} color={colors.warning} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.movementTitle}>{item.reason || item.type.replace('_', ' ')}</Text>
        <Text style={styles.movementMeta}>{item.actor_name} · {dateLabel(item.created_at)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.movementQty, { color: inbound ? colors.primary : colors.danger }]}>{inbound ? '+' : ''}{item.quantity_change}</Text>
        <Text style={styles.movementMeta}>After: {item.quantity_after}</Text>
      </View>
    </View>
  );
}

function StateView({ loading = false, message, onRetry }: { loading?: boolean; message: string; onRetry?: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.state}>
        {loading && <ActivityIndicator color={colors.primary} />}
        <Text style={[styles.muted, { marginTop: loading ? 12 : 0 }]}>{message}</Text>
        {onRetry && <View style={{ width: '100%', maxWidth: 300, marginTop: 16 }}><Button label="Try again" onPress={onRetry} /></View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36 },
  hero: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: 20, ...shadow },
  productImage: { width: '100%', height: 210, borderRadius: radius.lg, backgroundColor: colors.primaryLight },
  placeholder: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  category: { color: colors.textSecondary, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: { flexGrow: 1, flexBasis: 96, minWidth: 88, minHeight: 52, paddingHorizontal: 8, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryAction: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { color: colors.text, fontWeight: '700', fontSize: 12, flexShrink: 1, textAlign: 'center' },
  primaryActionText: { color: colors.white },
  readOnly: { color: colors.textSecondary, textAlign: 'center', marginTop: 12 },
  quantityCard: { marginTop: 12, padding: 16, backgroundColor: colors.primaryDark, borderRadius: radius.lg, alignItems: 'center' },
  quantityLabel: { color: '#E1F2E7', fontSize: 13 },
  quantityValue: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: colors.white, paddingHorizontal: 15, borderRadius: radius.lg, marginTop: 12, ...shadow },
  marginText: { color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'right' },
  moreDetails: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 14, backgroundColor: colors.white, borderRadius: radius.md },
  dataRow: { minHeight: 49, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.border },
  dataLabel: { color: colors.textSecondary, fontSize: 13 },
  dataValue: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  movementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 22, marginBottom: 10 },
  viewAll: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  section: { fontSize: 17, fontWeight: '800', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  muted: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  movement: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  movementIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  movementTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  movementMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  movementQty: { fontWeight: '800', fontSize: 15 },
  adjustLink: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', padding: 16 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
});
