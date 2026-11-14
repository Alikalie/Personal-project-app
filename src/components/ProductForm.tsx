import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button, Field, Screen } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius } from '@/constants/theme';
import { currencyFractionDigits, parseMoneyToMinorUnits } from '@/lib/money';
import type { Category } from '@/services/categoryService';
import type { Product, ProductInput } from '@/services/productService';

export type ProductFormValues = ProductInput & { openingQuantity: number };

type Props = {
  title: string;
  submitLabel: string;
  categories: Category[];
  initialProduct?: Product;
  initialImageUrl?: string | null;
  includeOpeningQuantity?: boolean;
  loading: boolean;
  error?: string;
  onSubmit: (values: ProductFormValues, imageUri: string | null) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
  onRetryImage?: (imageUri: string | null) => Promise<void>;
  retryLoading?: boolean;
};

function minorText(value: number | undefined, currencyCode: string): string {
  if (value === undefined) return '';
  const digits = currencyFractionDigits(currencyCode);
  const absolute = BigInt(Math.abs(value));
  const factor = 10n ** BigInt(digits);
  const major = String(absolute / factor);
  const fraction = digits ? String(absolute % factor).padStart(digits, '0') : '';
  return `${value < 0 ? '-' : ''}${major}${fraction ? `.${fraction}` : ''}`;
}

export default function ProductForm({
  title,
  submitLabel,
  categories,
  initialProduct,
  initialImageUrl,
  includeOpeningQuantity = false,
  loading,
  error,
  onSubmit,
  onCreateCategory,
  onRetryImage,
  retryLoading = false,
}: Props) {
  const { ctx } = useAuth();
  const currencyCode = ctx?.business?.currencyCode ?? 'SLE';
  const [name, setName] = useState(initialProduct?.name ?? '');
  const [sku, setSku] = useState(initialProduct?.sku ?? '');
  const [barcode, setBarcode] = useState(initialProduct?.barcode ?? '');
  const [categoryId, setCategoryId] = useState(initialProduct?.category_id ?? '');
  const [cost, setCost] = useState(minorText(initialProduct?.cost_price_minor, currencyCode));
  const [selling, setSelling] = useState(minorText(initialProduct?.selling_price_minor, currencyCode));
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState(String(initialProduct?.low_stock_threshold ?? 5));
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const chooseImage = async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow camera access to take a product photo.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow photo access to choose a product image.');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } catch (pickError) {
      setValidationError(pickError instanceof Error ? pickError.message : 'Could not open the image picker.');
    }
  };

  const addCategory = async () => {
    if (creatingCategory) return;
    setCreatingCategory(true);
    setCategoryError('');
    try {
      const created = await onCreateCategory(categoryName);
      setCategoryId(created.id);
      setCategoryName('');
    } catch (createError) {
      setCategoryError(createError instanceof Error ? createError.message : 'Could not create category.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const submit = async () => {
    setValidationError('');
    if (name.trim().length === 0) {
      setValidationError('Enter a product name.');
      return;
    }
    let costMinor: number;
    let sellingMinor: number;
    try {
      costMinor = parseMoneyToMinorUnits(cost, currencyCode);
      sellingMinor = parseMoneyToMinorUnits(selling, currencyCode);
    } catch (parseError) {
      setValidationError(parseError instanceof Error ? parseError.message : 'Enter valid prices.');
      return;
    }
    const thresholdValue = Number(threshold);
    const openingQuantity = quantity.trim() === '' ? 0 : Number(quantity);
    if (!/^\d+$/.test(threshold) || !Number.isSafeInteger(thresholdValue)) {
      setValidationError('Enter a whole-number low-stock threshold.');
      return;
    }
    if (!Number.isSafeInteger(openingQuantity) || openingQuantity < 0) {
      setValidationError('Opening quantity must be a non-negative whole number.');
      return;
    }
    await onSubmit({
      category_id: categoryId || null,
      name: name.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      cost_price_minor: costMinor,
      selling_price_minor: sellingMinor,
      low_stock_threshold: thresholdValue,
      openingQuantity,
    }, imageUri);
  };

  const costMinor = parseMoneyToMinorUnitsOrNull(cost, currencyCode);
  const sellingMinor = parseMoneyToMinorUnitsOrNull(selling, currencyCode);
  const belowCost = costMinor !== null && sellingMinor !== null && sellingMinor < costMinor;
  const marginBasisPoints = sellingMinor && costMinor !== null
    ? Math.round(((sellingMinor - costMinor) * 10000) / sellingMinor)
    : null;

  return (
    <Screen back title={title} subtitle="Enter clear details so your stock stays accurate."
      footer={
        <>
          {!!validationError && <Text style={{ color: colors.danger, marginBottom: 10 }}>{validationError}</Text>}
          {!!error && <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text>}
          {onRetryImage && (
            <Button label="Retry image upload" onPress={() => void onRetryImage(imageUri)} loading={retryLoading} disabled={loading || retryLoading || !imageUri} variant="outline" />
          )}
          <View style={{ height: 10 }} />
          <Button label={submitLabel} onPress={() => void submit()} loading={loading} disabled={loading || retryLoading} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        <View style={{ width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <ProductImage imageUrl={imageUri ?? initialImageUrl ?? null} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
          <Button label="Take photo" onPress={() => void chooseImage(true)} variant="outline" disabled={loading} />
          <Button label="Choose image" onPress={() => void chooseImage(false)} variant="outline" disabled={loading} />
        </View>
      </View>

      <Field label="Product name *" icon={Tag} value={name} onChangeText={setName} placeholder="Enter product name" />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        <Chip label="No category" selected={!categoryId} onPress={() => setCategoryId('')} />
        {categories.map((category) => (
          <Chip key={category.id} label={category.name} selected={category.id === categoryId} onPress={() => setCategoryId(category.id)} />
        ))}
      </View>
      <View style={styles.inline}>
        <TextInput value={categoryName} onChangeText={setCategoryName} placeholder="Create a category" placeholderTextColor={colors.textSecondary} style={styles.categoryInput} />
        <Pressable onPress={() => void addCategory()} disabled={creatingCategory || !categoryName.trim()} style={styles.addCategory}>
          <Plus size={20} color={colors.white} />
        </Pressable>
      </View>
      {!!categoryError && <Text style={styles.error}>{categoryError}</Text>}

      <Field label={`Purchase price (${currencyCode}) *`} value={cost} onChangeText={setCost} placeholder={currencyCode === 'XOF' || currencyCode === 'XAF' ? 'e.g. 12500' : 'e.g. 12500.50'} keyboardType="decimal-pad" />
      <Field label={`Selling price (${currencyCode}) *`} value={selling} onChangeText={setSelling} placeholder={currencyCode === 'XOF' || currencyCode === 'XAF' ? 'e.g. 15000' : 'e.g. 15000.00'} keyboardType="decimal-pad" />
      {belowCost && <Text style={styles.warning}>Selling price is below purchase price.</Text>}
      {marginBasisPoints !== null && <Text style={styles.hint}>Estimated margin: {Math.floor(marginBasisPoints / 100)}.{String(Math.abs(marginBasisPoints % 100)).padStart(2, '0')}%</Text>}

      {includeOpeningQuantity && (
        <Field label="Opening quantity" value={quantity} onChangeText={setQuantity} placeholder="0" keyboardType="number-pad" />
      )}
      <Pressable
        onPress={() => setShowMoreDetails((value) => !value)}
        style={styles.moreDetailsToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: showMoreDetails }}
        accessibilityLabel={showMoreDetails ? 'Hide more product details' : 'Show more product details'}
      >
        <Text style={styles.moreDetailsText}>More details</Text>
        {showMoreDetails ? <ChevronUp size={20} color={colors.primaryDark} /> : <ChevronDown size={20} color={colors.primaryDark} />}
      </Pressable>
      {showMoreDetails ? (
        <View>
          <Field label="Product code (optional)" value={sku} onChangeText={setSku} placeholder="Enter a product code" autoCapitalize="characters" />
          <Field label="Barcode (optional)" value={barcode} onChangeText={setBarcode} placeholder="Barcode number" keyboardType="number-pad" />
          <Field label="Low-stock threshold" value={threshold} onChangeText={setThreshold} placeholder="5" keyboardType="number-pad" />
        </View>
      ) : null}
    </Screen>
  );
}

function parseMoneyToMinorUnitsOrNull(value: string, currencyCode: string): number | null {
  try {
    return parseMoneyToMinorUnits(value, currencyCode);
  } catch {
    return null;
  }
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.selectedChip]}>
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.white },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' as const },
  selectedChipText: { color: colors.primaryDark },
  inline: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
  categoryInput: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text },
  addCategory: { width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary },
  moreDetailsToggle: { minHeight: 52, marginTop: 4, marginBottom: 12, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderRadius: 12, backgroundColor: colors.white },
  moreDetailsText: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' as const },
  error: { color: colors.danger, fontSize: 12, marginBottom: 12 },
  warning: { color: colors.warning, fontSize: 13, fontWeight: '700' as const, marginTop: -8, marginBottom: 10 },
  hint: { color: colors.textSecondary, fontSize: 13, marginTop: -8, marginBottom: 14 },
};
