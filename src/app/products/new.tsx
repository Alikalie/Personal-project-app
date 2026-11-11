import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import ProductForm, { type ProductFormValues } from '@/components/ProductForm';
import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { newId } from '@/lib/uuid';
import { createCategory, listCategories, type Category } from '@/services/categoryService';
import {
  adjustStock,
  createProduct,
  updateProductImagePath,
  uploadProductImage,
} from '@/services/productService';

export default function NewProduct() {
  const { ctx } = useAuth();
  const businessId = ctx?.businessId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retryingImage, setRetryingImage] = useState(false);
  const [error, setError] = useState('');
  const productId = useRef<string | null>(null);
  const savedValues = useRef<ProductFormValues | null>(null);
  const appliedOpeningStock = useRef(false);
  const uploadedPath = useRef<string | null>(null);
  const pendingImage = useRef<string | null>(null);

  const loadCategories = useCallback(async () => {
    if (!businessId) {
      setCategoriesError('Your business is not available.');
      setCategoriesLoading(false);
      return;
    }
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      setCategories(await listCategories(businessId));
    } catch (loadError) {
      setCategoriesError(friendlyErrorMessage(loadError));
    } finally {
      setCategoriesLoading(false);
    }
  }, [businessId]);
  useEffect(() => { void loadCategories(); }, [loadCategories]);

  const addCategory = async (name: string) => {
    if (!businessId) throw new Error('Your business is not available.');
    const category = await createCategory(businessId, name);
    setCategories((items) => [...items, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category;
  };

  const finishSavedProduct = async (imageUri: string | null) => {
    const id = productId.current;
    const values = savedValues.current;
    if (!id || !values || !businessId) throw new Error('Save the product details first.');

    pendingImage.current = imageUri;
    if (imageUri && !uploadedPath.current) {
      try {
        const path = await uploadProductImage(imageUri, businessId, id);
        await updateProductImagePath(id, path);
        uploadedPath.current = path;
      } catch (imageError) {
        setError(`Product saved, but the image could not be uploaded. ${friendlyErrorMessage(imageError)}`);
        return;
      }
    }

    if (values.openingQuantity > 0 && !appliedOpeningStock.current) {
      await adjustStock(businessId, id, 'opening', values.openingQuantity, 'Opening balance');
      appliedOpeningStock.current = true;
    }
    router.replace({ pathname: '/products/[id]', params: { id } });
  };

  const save = async (values: ProductFormValues, imageUri: string | null) => {
    if (saving || !businessId) return;
    setSaving(true);
    setError('');
    try {
      if (!productId.current) {
        const id = newId();
        const { openingQuantity: _openingQuantity, ...productInput } = values;
        await createProduct(businessId, productInput, id);
        productId.current = id;
        savedValues.current = values;
      } else {
        savedValues.current = values;
      }
      await finishSavedProduct(imageUri);
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const retryImage = async (imageUri: string | null) => {
    if (!imageUri || retryingImage) return;
    setRetryingImage(true);
    setError('');
    try {
      await finishSavedProduct(imageUri);
    } catch (retryError) {
      setError(friendlyErrorMessage(retryError));
    } finally {
      setRetryingImage(false);
    }
  };

  if (categoriesLoading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSecondary, marginTop: 10 }}>Loading categories...</Text></View>;
  }
  if (categoriesError) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}><Text style={{ color: colors.danger, textAlign: 'center' }}>{categoriesError}</Text><Text onPress={() => void loadCategories()} style={{ color: colors.primary, fontWeight: '700', marginTop: 16 }}>Try again</Text></View>;
  }

  return (
    <ProductForm
      title="Add product"
      submitLabel={productId.current ? 'Continue saving product' : 'Save product'}
      categories={categories}
      includeOpeningQuantity
      loading={saving}
      error={error}
      onSubmit={save}
      onCreateCategory={addCategory}
      onRetryImage={retryImage}
      retryLoading={retryingImage}
    />
  );
}
