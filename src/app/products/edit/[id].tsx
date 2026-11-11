import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ProductForm, { type ProductFormValues } from '@/components/ProductForm';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { createCategory, listCategories, type Category } from '@/services/categoryService';
import {
  getProduct,
  softDeleteProduct,
  updateProduct,
  updateProductImagePath,
  uploadProductImage,
  type Product,
} from '@/services/productService';

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ctx } = useAuth();
  const canWrite = ['owner', 'manager'].includes(ctx?.business?.role?.toLowerCase() ?? '');
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retryingImage, setRetryingImage] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);

  const load = useCallback(async () => {
    if (!id || !ctx?.businessId) {
      setLoading(false);
      setError('Product or business is unavailable.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [productResult, categoryResult] = await Promise.all([
        getProduct(id),
        listCategories(ctx.businessId),
      ]);
      setProduct(productResult);
      setCategories(categoryResult);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ctx?.businessId, id]);
  useEffect(() => { void load(); }, [load]);

  const addCategory = async (name: string) => {
    if (!ctx?.businessId) throw new Error('Your business is not available.');
    const category = await createCategory(ctx.businessId, name);
    setCategories((items) => [...items, category]);
    return category;
  };

  const save = async (values: ProductFormValues, imageUri: string | null) => {
    if (!product || saving || !canWrite) return;
    setSaving(true);
    setError('');
    setImageError(false);
    try {
      const { openingQuantity: _ignoredOpeningQuantity, ...productInput } = values;
      await updateProduct(product.id, productInput);
      if (imageUri && ctx?.businessId) {
        try {
          const path = await uploadProductImage(imageUri, ctx.businessId, product.id);
          await updateProductImagePath(product.id, path);
        } catch (uploadError) {
          setImageError(true);
          setError(`Product updated, but its image could not be uploaded. ${friendlyErrorMessage(uploadError)}`);
          return;
        }
      }
      router.replace({ pathname: '/products/[id]', params: { id: product.id } });
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const retryImage = async (imageUri: string | null) => {
    if (!imageUri || !product || !ctx?.businessId || retryingImage) return;
    setRetryingImage(true);
    setError('');
    try {
      const path = await uploadProductImage(imageUri, ctx.businessId, product.id);
      await updateProductImagePath(product.id, path);
      router.replace({ pathname: '/products/[id]', params: { id: product.id } });
    } catch (uploadError) {
      setError(friendlyErrorMessage(uploadError));
    } finally {
      setRetryingImage(false);
    }
  };

  const confirmDelete = () => {
    if (!product || deleting) return;
    Alert.alert('Delete product?', `${product.name} will be removed from active stock lists. Its stock history will remain.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete product',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          setError('');
          void softDeleteProduct(product.id)
            .then(() => router.replace('/(tabs)/stock'))
            .catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError)))
            .finally(() => setDeleting(false));
        },
      },
    ]);
  };

  if (loading) return <LoadingState message="Loading product details..." />;
  if (error && !product) return <LoadingState message={error} onRetry={() => void load()} />;
  if (!product) return <LoadingState message="Product not found." />;
  if (!canWrite) return <LoadingState message="You do not have permission to edit products." />;

  return (
    <View style={{ flex: 1 }}>
      <ProductForm
        title="Edit product"
        submitLabel="Save changes"
        categories={categories}
        initialProduct={product}
        initialImageUrl={product.image_url}
        loading={saving || deleting}
        error={error}
        onSubmit={save}
        onCreateCategory={addCategory}
        onRetryImage={imageError ? retryImage : undefined}
        retryLoading={retryingImage}
      />
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, backgroundColor: colors.white }}>
        <Button label="Delete product" variant="outline" loading={deleting} disabled={saving || deleting} onPress={confirmDelete} />
      </View>
    </View>
  );
}

function LoadingState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background }}>
      {!onRetry && !message.startsWith('You do not have') && <ActivityIndicator color={colors.primary} />}
      <Text style={{ color: message.includes('permission') ? colors.danger : colors.textSecondary, marginTop: 12, textAlign: 'center' }}>{message}</Text>
      {onRetry && <View style={{ width: '100%', maxWidth: 300, marginTop: 16 }}><Button label="Try again" onPress={onRetry} /></View>}
    </View>
  );
}
