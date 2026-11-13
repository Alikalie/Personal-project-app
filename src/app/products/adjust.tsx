import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { adjustStock, getProduct, type Product } from '@/services/productService';

const stockInReasons = ['New delivery', 'Returned by customer', 'Other'];
const stockOutReasons = ['Damaged', 'Expired', 'Lost', 'Other'];
const adjustmentReasons = ['Correction', 'Other'];
type AdjustmentType = 'stock_in' | 'stock_out' | 'adjustment';

export default function AdjustProductStock() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const productId = params.id;
  const type: AdjustmentType = params.type === 'stock_out' || params.type === 'adjustment' ? params.type : 'stock_in';
  const { ctx } = useAuth();
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const canWrite = ['owner', 'manager'].includes(ctx?.business?.role?.toLowerCase() ?? '');
  const reasons = useMemo(
    () => type === 'stock_in' ? stockInReasons : type === 'stock_out' ? stockOutReasons : adjustmentReasons,
    [type],
  );
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newQuantity, setNewQuantity] = useState<number | null>(null);
  const submitLock = useRef(false);

  const load = useCallback(async () => {
    if (!productId) {
      setError('Product not found.');
      setLoading(false);
      return;
    }
    if (!businessId) {
      setError('Your business is not available.');
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
  }, [businessId, productId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setReason(reasons[0]);
  }, [reasons]);

  const parsedQuantity = useMemo(() => {
    const trimmed = quantity.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }, [quantity]);

  const validationMessage = !quantity.trim() || parsedQuantity === null
    ? 'Enter a whole-number quantity.'
    : parsedQuantity === 0
      ? 'Quantity must be greater than zero.'
      : type !== 'adjustment' && parsedQuantity < 0
        ? 'Enter a positive quantity.'
        : type === 'stock_out' && product && parsedQuantity > product.quantity
          ? `Only ${product.quantity} units are available.`
          : '';

  const step = (amount: number) => {
    const current = /^-?\d+$/.test(quantity) ? Number(quantity) : 0;
    const next = current + amount;
    if (type !== 'adjustment' && next < 0) return;
    if (type === 'stock_out' && product && next > product.quantity) return;
    setQuantity(String(next));
    setError('');
  };

  const submit = async () => {
    if (!product || !businessId || saving || submitLock.current) return;
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (parsedQuantity === null) return;
    submitLock.current = true;
    setSaving(true);
    setError('');
    try {
      const movementType = type === 'stock_in' && reason === 'Returned by customer' ? 'return' : type;
      const reasonWithNote = note.trim() ? `${reason}: ${note.trim()}` : reason;
      const currentQuantity = await adjustStock(businessId, product.id, movementType, parsedQuantity, reasonWithNote);
      setNewQuantity(currentQuantity);
    } catch (saveError) {
      console.warn('Stock adjustment failed:', saveError);
      setError(friendlyErrorMessage(saveError));
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  if (loading) return <State message="Loading product..." loading />;
  if (!product) return <State message={error || 'Product not found.'} onRetry={() => void load()} />;
  if (!canWrite) return <State message="You do not have permission to change stock." />;

  if (newQuantity !== null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.state}>
          <Text style={styles.successTitle}>{type === 'stock_in' ? 'Stock added' : type === 'stock_out' ? 'Stock removed' : 'Stock updated'}</Text>
          <Text style={styles.subtitle}>{product.name}</Text>
          <Text style={styles.newQuantity}>{newQuantity}</Text>
          <Text style={styles.subtitle}>Current quantity</Text>
          <View style={{ width: '100%', marginTop: 22 }}><Button label="Done" onPress={() => router.back()} /></View>
        </View>
      </SafeAreaView>
    );
  }

  const title = type === 'stock_in' ? 'Stock in' : type === 'stock_out' ? 'Stock out' : 'Stock adjustment';
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}><ScreenHeader title={title} onBack={() => router.back()} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{product.name} · Available: {product.quantity}</Text>
          <Text style={styles.label}>{type === 'adjustment' ? 'Signed correction' : 'Quantity'}</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => step(-1)}
              disabled={saving || (type !== 'adjustment' && parsedQuantity !== null && parsedQuantity <= 1)}
              style={[styles.stepButton, saving && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <Minus size={22} color={colors.primaryDark} />
            </Pressable>
            <TextInput
              value={quantity}
              onChangeText={(value) => {
                setQuantity(type === 'adjustment' ? value.replace(/[^\d-]/g, '') : value.replace(/\D/g, ''));
                setError('');
              }}
              keyboardType={type === 'adjustment' ? 'numbers-and-punctuation' : 'number-pad'}
              editable={!saving}
              style={styles.quantityInput}
              accessibilityLabel="Quantity"
            />
            <Pressable
              onPress={() => step(1)}
              disabled={saving || (type === 'stock_out' && parsedQuantity !== null && parsedQuantity >= product.quantity)}
              style={[styles.stepButton, saving && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Plus size={22} color={colors.primaryDark} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{type === 'adjustment' ? 'Use a positive number to add stock or a negative number to remove stock.' : 'Enter a whole number of units.'}</Text>
          <Text style={[styles.label, { marginTop: 20 }]}>Reason</Text>
          <View style={styles.reasons}>
            {reasons.map((item) => {
              const selected = item === reason;
              return (
                <Pressable
                  key={item}
                  onPress={() => setReason(item)}
                  disabled={saving}
                  style={[styles.reason, selected && styles.selectedReason]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: saving }}
                >
                  <Text style={[styles.reasonText, selected && styles.selectedReasonText]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="Optional note" value={note} onChangeText={setNote} placeholder="Add a short note" multiline numberOfLines={3} editable={!saving} />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={title}
            onPress={() => void submit()}
            loading={saving}
            disabled={saving || Boolean(validationMessage)}
          />
          {!saving && validationMessage ? <Text style={styles.error}>{validationMessage}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function State({ message, loading = false, onRetry }: { message: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={styles.state}>{loading && <ActivityIndicator color={colors.primary} />}<Text style={styles.subtitle}>{message}</Text>{onRetry && <View style={{ width: '100%', marginTop: 16 }}><Button label="Try again" onPress={onRetry} /></View>}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.background },
  subtitle: { color: colors.textSecondary, marginTop: 6, lineHeight: 21, textAlign: 'center' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 9 },
  stepper: { height: 66, backgroundColor: colors.white, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderWidth: 1, borderColor: colors.border },
  stepButton: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
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
