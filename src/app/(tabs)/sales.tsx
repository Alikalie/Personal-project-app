import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { Card, Chip as DesignChip, EmptyState, IconButton, ScreenHeader, Skeleton } from '@/components/ds';
import { Button } from '@/components/ui';
import { colors, radius, shadow } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { listCategories, type Category } from '@/services/categoryService';
import { listSellableProducts } from '@/services/salesService';
import type { Product } from '@/services/productService';

export default function Sales() {
  const { ctx } = useAuth();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!ctx?.businessId) {
      setLoading(false);
      setError('Your business is not available.');
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [productRows, categoryRows] = await Promise.all([
        listSellableProducts(ctx.businessId, { search: debouncedSearch, categoryId: categoryId ?? undefined }),
        listCategories(ctx.businessId),
      ]);
      setProducts(productRows);
      setCategories(categoryRows);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, ctx?.businessId, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const add = (product: Product) => {
    const result = cart.addItem({
      productId: product.id,
      name: product.name,
      unitPriceMinor: product.selling_price_minor,
      maxStock: product.quantity,
    });
    if (!result.added && result.message) Alert.alert('Cannot add item', result.message);
  };

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <ScreenHeader title="Sell" subtitle="Tap a product to add it" />
      </View>
      <View style={styles.search}>
        <Search size={19} color={colors.textSecondary} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products by name or code" placeholderTextColor={colors.textSecondary} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search products by name or code" />
      </View>
      <View style={styles.chipStrip}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', name: 'All' }, ...categories.map((category) => ({ id: category.id, name: category.name }))]}
          keyExtractor={(item) => item.id || 'all'}
          renderItem={({ item }) => {
            const selected = (categoryId ?? '') === item.id;
            return <View style={styles.chipItem}><DesignChip label={item.name} selected={selected} onPress={() => setCategoryId(item.id || null)} /></View>;
          }}
        />
      </View>
      {error ? (
        <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading products"><Text style={styles.retryText}>Try again</Text></Pressable></View>
      ) : loading ? (
        <View style={styles.grid}>{[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} height={224} radius={16} width="48%" />)}</View>
      ) : products.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No products found" message="Try a different search or category." />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const outOfStock = item.quantity <= 0;
            return (
              <Pressable
                disabled={outOfStock}
                onPress={() => add(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${formatSLE(item.selling_price_minor)}, ${outOfStock ? 'out of stock' : `${item.quantity} left`}`}
                accessibilityState={{ disabled: outOfStock }}
                style={[styles.productCard, outOfStock && styles.outOfStock]}
              >
                <Card style={styles.productCardContent}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={styles.productImage} contentFit="cover" />
                    : <View style={styles.placeholder}><ShoppingCart size={28} color={colors.primary} /></View>}
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.productPrice}>{formatSLE(item.selling_price_minor)}</Text>
                  <Text style={styles.stockCount}>{outOfStock ? 'Out of stock' : `${item.quantity} in stock`}</Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      {cart.items.length > 0 && (
        <Pressable onPress={() => setShowCart(true)} style={styles.cartBar} accessibilityRole="button" accessibilityLabel={`Review sale, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, total ${formatSLE(cart.totals.total)}`}>
          <View style={styles.cartCount}><Text style={styles.cartCountText}>{itemCount}</Text></View>
          <Text style={styles.cartLabel}>{itemCount} {itemCount === 1 ? 'item' : 'items'} - {formatSLE(cart.totals.total)} - Review sale</Text>
          <ShoppingCart size={20} color={colors.white} />
        </Pressable>
      )}
      <Modal visible={showCart} animationType="slide" transparent onRequestClose={() => setShowCart(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => setShowCart(false)}
            accessibilityRole="button"
            accessibilityLabel="Close sale review"
          />
          <View style={styles.cartSheet}>
            <View style={styles.cartHeader}>
              <View style={styles.cartHeaderText}>
                <Text style={styles.cartTitle}>Review sale</Text>
                <Text style={styles.cartSubtitle}>Check the items and total.</Text>
              </View>
              <IconButton icon={X} label="Close sale review" onPress={() => setShowCart(false)} />
            </View>
            <ScrollView contentContainerStyle={styles.cartItems} keyboardShouldPersistTaps="handled">
              {cart.items.length === 0 ? <Text style={styles.emptyCartText}>No items in this sale.</Text> : cart.items.map((item) => (
                <View key={item.productId} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>
                      {formatSLE(item.unitPriceMinor)} each · {formatSLE(item.unitPriceMinor * item.quantity)}
                    </Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <Pressable
                      onPress={() => {
                        if (item.quantity === 1) cart.removeItem(item.productId);
                        else cart.setQuantity(item.productId, item.quantity - 1);
                      }}
                      style={styles.quantityButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Reduce ${item.name} quantity`}
                    >
                      <Minus size={18} color={colors.primaryDark} />
                    </Pressable>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => {
                        const result = cart.setQuantity(item.productId, item.quantity + 1);
                        if (!result.changed && result.message) Alert.alert('Cannot add item', result.message);
                      }}
                      style={styles.quantityButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Add one ${item.name}`}
                    >
                      <Plus size={18} color={colors.primaryDark} />
                    </Pressable>
                  </View>
                  <IconButton
                    icon={Trash2}
                    label={`Remove ${item.name} from sale`}
                    disabled={cart.locked}
                    onPress={() => cart.removeItem(item.productId)}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatSLE(cart.totals.total)}</Text>
            </View>
            <Button label="Back to products" onPress={() => setShowCart(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  search: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.white, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15 },
  chipStrip: { height: 56, marginTop: 4 },
  chipItem: { marginLeft: 8 },
  grid: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 88, gap: 12 },
  gridRow: { gap: 12 },
  productCard: { flex: 1, minWidth: 0, borderRadius: radius.lg },
  productCardContent: { flex: 1, padding: 12, gap: 8, opacity: 1 },
  outOfStock: { opacity: 0.48 },
  productImage: { width: '100%', height: 104, borderRadius: 12, backgroundColor: colors.primaryLight },
  placeholder: { width: '100%', height: 104, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  productName: { color: colors.text, fontSize: 15, fontWeight: '700', minHeight: 40 },
  productPrice: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
  stockCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  error: { color: colors.danger, textAlign: 'center', lineHeight: 22 },
  retry: { padding: 14 },
  retryText: { color: colors.primary, fontWeight: '800' },
  cartBar: { position: 'absolute', left: 16, right: 16, bottom: 12, minHeight: 58, borderRadius: 16, backgroundColor: colors.primaryDark, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  cartCount: { minWidth: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: colors.white, fontWeight: '800' },
  cartLabel: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '800' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  cartSheet: { maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, gap: 12 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartHeaderText: { flex: 1 },
  cartTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  cartSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  cartItems: { gap: 8, paddingVertical: 4 },
  emptyCartText: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  cartItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.white },
  cartItemInfo: { flex: 1, minWidth: 0 },
  cartItemName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cartItemPrice: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quantityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primaryLight },
  quantityText: { minWidth: 20, textAlign: 'center', color: colors.text, fontSize: 14, fontWeight: '700' },
  totalRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  totalValue: { color: colors.primaryDark, fontSize: 22, fontWeight: '800' },
});
