import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';

import { Button, Field } from '@/components/ui';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { adjustStock, getProduct, type Product } from '@/services/productService';

const reasons = ['New delivery', 'Returned by customer', 'Damaged', 'Expired', 'Lost', 'Correction', 'Other'];
type AdjustmentType = 'stock_in' | 'stock_out' | 'adjustment';

export default function AdjustProductStock() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const productId = params.id;
  const type: AdjustmentType = params.type === 'stock_out' || params.type === 'adjustment' ? params.type : 'stock_in';
  const { ctx } = useAuth();
  const canWrite = ['owner', 'manager'].includes(ctx?.business?.role?.toLowerCase() ?? '');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newQuantity, setNewQuantity] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!productId) {
      setError('Product not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setProduct(await getProduct(productId));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [productId]);
  useEffect(() => { void load(); }, [load]);

  const step = (amount: number) => {
    const current = /^-?\d+$/.test(quantity) ? Number(quantity) : 0;
    const next = current + amount;
    if (type !== 'adjustment' && next < 0) return;
    if (type === 'stock_out' && product && next > product.quantity) return;
    setQuantity(String(next));
  };

  const submit = async () => {
    if (!product || !ctx?.businessId || saving) return;
    const parsed = Number(quantity);
    if (!Number.isSafeInteger(parsed) || parsed === 0) {
      setError(type === 'adjustment' ? 'Enter a signed, non-zero correction.' : 'Enter a positive whole-number quantity.');
      return;
    }
    if (type === 'stock_out' && parsed > product.quantity) {
      setError(`Only ${product.quantity} units are available.`);
      return;
    }
    if (type !== 'adjustment' && parsed < 1) {
      setError('Enter a positive whole-number quantity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const movementType = type === 'stock_in' && reason === 'Returned by customer' ? 'return' : type;
      const reasonWithNote = note.trim() ? `${reason}: ${note.trim()}` : reason;
      const currentQuantity = await adjustStock(ctx.businessId, product.id, movementType, parsed, reasonWithNote);
      setNewQuantity(currentQuantity);
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <State message="Loading product..." loading />;
  if (!product) return <State message={error || 'Product not found.'} onRetry={() => void load()} />;
  if (!canWrite) return <State message="You do not have permission to change stock." />;

  if (newQuantity !== null) {
    return (
      <View style={styles.state}>
        <Text style={styles.successTitle}>Stock updated</Text>
        <Text style={styles.subtitle}>{product.name}</Text>
        <Text style={styles.newQuantity}>{newQuantity}</Text>
        <Text style={styles.subtitle}>Current quantity</Text>
        <View style={{ width: '100%', marginTop: 22 }}><Button label="Done" onPress={() => router.back()} /></View>
      </View>
    );
  }

  const title = type === 'stock_in' ? 'Stock in' : type === 'stock_out' ? 'Stock out' : 'Stock adjustment';
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><ScreenHeader title={title} onBack={() => router.back()} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>{product.name} · Available: {product.quantity}</Text>
      <Text style={styles.label}>{type === 'adjustment' ? 'Signed correction' : 'Quantity'}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} style={styles.stepButton}><Minus size={22} color={colors.primaryDark} /></Pressable>
        <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numbers-and-punctuation" style={styles.quantityInput} />
        <Pressable onPress={() => step(1)} style={styles.stepButton}><Plus size={22} color={colors.primaryDark} /></Pressable>
      </View>
      <Text style={styles.hint}>{type === 'adjustment' ? 'Use a positive number to add stock or a negative number to remove stock.' : 'Use the buttons or enter a whole number.'}</Text>
      <Text style={[styles.label, { marginTop: 20 }]}>Reason</Text>
      <View style={styles.reasons}>
        {reasons.map((item) => {
          const selected = item === reason;
          return <Pressable key={item} onPress={() => setReason(item)} style={[styles.reason, selected && styles.selectedReason]}><Text style={[styles.reasonText, selected && styles.selectedReasonText]}>{item}</Text></Pressable>;
        })}
      </View>
      <Field label="Optional note" value={note} onChangeText={setNote} placeholder="Add a short note" multiline numberOfLines={3} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={title} onPress={() => void submit()} loading={saving} disabled={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

function State({ message, loading = false, onRetry }: { message: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={styles.state}>{loading && <ActivityIndicator color={colors.primary} />}<Text style={styles.subtitle}>{message}</Text>{onRetry && <View style={{ width: '100%', marginTop: 16 }}><Button label="Try again" onPress={onRetry} /></View>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.background },
  subtitle: { color: colors.textSecondary, marginTop: 6, lineHeight: 21, textAlign: 'center' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 9 },
  stepper: { height: 66, backgroundColor: colors.white, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderWidth: 1, borderColor: colors.border },
  stepButton: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  quantityInput: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 7, lineHeight: 18 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  reason: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  selectedReason: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  reasonText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  selectedReasonText: { color: colors.primaryDark },
  error: { color: colors.danger, marginBottom: 12 },
  state: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  successTitle: { color: colors.primaryDark, fontSize: 22, fontWeight: '800' },
  newQuantity: { color: colors.primary, fontSize: 54, fontWeight: '800', marginTop: 20 },
});
