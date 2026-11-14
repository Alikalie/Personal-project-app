import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { Card, Chip as DesignChip, EmptyState, IconButton, ScreenHeader, Skeleton } from '@/components/ds';
import { ProductImage } from '@/components/ProductImage';
import { ReceiptActions } from '@/components/receipts/ReceiptActions';
import { Button } from '@/components/ui';
import { colors, radius, shadow } from '@/constants/theme';
import { calculateCashChange } from '@/lib/cart';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE, parseMoneyToMinorUnits } from '@/lib/money';
import { buildSaleReceiptData } from '@/lib/receipt/buildReceiptData';
import type { ReceiptData } from '@/lib/receipt/types';
import { listCategories, type Category } from '@/services/categoryService';
import { searchCustomers, type Customer } from '@/services/customerService';
import { refreshDashboardViews } from '@/services/dashboardService';
import { createSale, getSale, listSellableProducts, type PaymentMethod, type SaleRecord } from '@/services/salesService';
import type { Product } from '@/services/productService';

const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash received' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'afrimoney', label: 'Afrimoney' },
  { id: 'other', label: 'Other' },
];

type PaymentAmounts = Record<PaymentMethod, string>;
const emptyPaymentAmounts: PaymentAmounts = { cash: '', orange_money: '', afrimoney: '', other: '' };

function paymentLabel(method: string): string {
  return paymentMethods.find((item) => item.id === method)?.label.replace(' received', '') ?? method;
}

export default function Sales() {
  const { ctx, loading: authLoading } = useAuth();
  const cart = useCart();
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmounts>(emptyPaymentAmounts);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saleResult, setSaleResult] = useState<SaleRecord | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [postSaleWarning, setPostSaleWarning] = useState('');
  const [successChangeMinor, setSuccessChangeMinor] = useState(0);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!authLoading && ctx && !ctx.business) router.replace('/onboarding/business');
  }, [authLoading, ctx]);

  const refreshProductData = useCallback(async () => {
    if (!businessId) throw new Error('Your business is not available.');
    const [productRows, categoryRows] = await Promise.all([
      listSellableProducts(businessId, { search: debouncedSearch, categoryId: categoryId ?? undefined }),
      listCategories(businessId),
    ]);
    setProducts(productRows);
    setCategories(categoryRows);
  }, [businessId, categoryId, debouncedSearch]);

  const load = useCallback(async (refresh = false) => {
    if (!businessId) {
      setLoading(false);
      setError(ctx ? 'Your business is not available.' : 'Sign in to sell.');
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      await refreshProductData();
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, ctx, refreshProductData]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!showPayment || !businessId || saleResult) return undefined;
    let active = true;
    setCustomerLoading(true);
    setCustomerError('');
    const timer = setTimeout(() => {
      void searchCustomers(businessId, customerSearch).then((rows) => {
        if (active) setCustomerOptions(rows);
      }).catch((customerLoadError: unknown) => {
        if (active) setCustomerError(friendlyErrorMessage(customerLoadError));
      }).finally(() => {
        if (active) setCustomerLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [businessId, customerSearch, saleResult, showPayment]);

  const parsedAmounts = useMemo(() => {
    const amounts = { cash: 0, orange_money: 0, afrimoney: 0, other: 0 };
    try {
      for (const method of paymentMethods) {
        const input = paymentAmounts[method.id].trim();
        if (input) amounts[method.id] = parseMoneyToMinorUnits(input);
      }
      return { amounts, error: '' };
    } catch {
      return { amounts: null, error: 'Enter a valid payment amount.' };
    }
  }, [paymentAmounts]);

  const nonCashTotal = parsedAmounts.amounts
    ? parsedAmounts.amounts.orange_money + parsedAmounts.amounts.afrimoney + parsedAmounts.amounts.other
    : 0;
  const cashDue = Math.max(0, cart.totals.total - nonCashTotal);
  const cashChange = parsedAmounts.amounts
    ? calculateCashChange(parsedAmounts.amounts.cash, cashDue)
    : { appliedMinor: 0, changeMinor: 0 };
  const paymentTotal = nonCashTotal + cashChange.appliedMinor;
  const unpaidMinor = Math.max(0, cart.totals.total - paymentTotal);
  const payments = parsedAmounts.amounts
    ? paymentMethods.flatMap(({ id }) => {
      const amountMinor = id === 'cash' ? cashChange.appliedMinor : parsedAmounts.amounts?.[id] ?? 0;
      return amountMinor > 0 ? [{ method: id, amountMinor, reference: null }] : [];
    })
    : [];
  const paymentBlockReason = !cart.items.length
    ? 'Your cart is empty.'
    : parsedAmounts.error
      ? parsedAmounts.error
      : nonCashTotal > cart.totals.total
        ? 'Payments are more than the total.'
        : paymentTotal < cart.totals.total && !cart.customer
          ? paymentAmounts.cash.trim() || paymentAmounts.orange_money.trim() || paymentAmounts.afrimoney.trim() || paymentAmounts.other.trim()
            ? 'Choose a customer to sell on credit.'
            : 'Enter a payment amount or choose a customer for credit.'
          : '';

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

  const confirmSale = async () => {
    if (submitLock.current || paymentBlockReason || !businessId) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const saleId = cart.ensureSaleId();
      const savedSaleId = await createSale({
        saleId,
        businessId,
        customerId: cart.customer?.id ?? null,
        items: cart.items,
        discountMinor: cart.totals.discount,
        payments,
      });
      const savedAt = new Date().toISOString();
      const fallbackSale: SaleRecord = {
        sale: {
          id: savedSaleId,
          business_id: businessId,
          customer_id: cart.customer?.id ?? null,
          receipt_no: `SB-${savedSaleId.slice(0, 8).toUpperCase()}`,
          total_minor: cart.totals.total,
          discount_minor: cart.totals.discount,
          credit_minor: unpaidMinor,
          gross_profit_minor: null,
          sold_at: savedAt,
          cashier_id: ctx?.id ?? null,
        },
        items: cart.items.map((item, index) => ({
          id: `${savedSaleId}-${index}`,
          product_id: item.productId,
          name: item.name,
          quantity: item.quantity,
          unit_price_minor: item.unitPriceMinor,
          line_total_minor: item.unitPriceMinor * item.quantity,
        })),
        payments: payments.map((payment, index) => ({
          id: `${savedSaleId}-payment-${index}`,
          method: payment.method,
          amount_minor: payment.amountMinor,
          reference: payment.reference,
        })),
        customer: cart.customer
          ? {
            id: cart.customer.id,
            business_id: businessId,
            name: cart.customer.name,
            phone: cart.customer.phone ?? null,
          }
          : null,
        cashierName: ctx?.name ?? 'Team member',
      };
      let savedSale = fallbackSale;
      try {
        savedSale = await getSale(savedSaleId);
      } catch (receiptLoadError) {
        console.warn('Sale was recorded; using in-memory receipt details:', receiptLoadError);
      }

      cart.clearCart();
      const refreshWarnings: string[] = [];
      if (savedSale === fallbackSale) {
        refreshWarnings.push('The sale was saved. Receipt details are using the information on this device.');
      }
      try {
        await refreshProductData();
      } catch (refreshError) {
        refreshWarnings.push(`Products could not refresh: ${friendlyErrorMessage(refreshError)}`);
      }
      try {
        await refreshDashboardViews(businessId);
      } catch (refreshError) {
        refreshWarnings.push(`Dashboard could not refresh: ${friendlyErrorMessage(refreshError)}`);
      }
      let generatedReceipt: ReceiptData | null = null;
      try {
        generatedReceipt = buildSaleReceiptData(savedSale, {
          name: ctx?.business?.name ?? null,
          address: ctx?.business?.address ?? null,
          phone: ctx?.business?.phone ?? null,
          receipt_header: ctx?.business?.receiptHeader ?? null,
          receipt_footer: ctx?.business?.receiptFooter ?? null,
          show_logo_on_receipt: ctx?.business?.showLogoOnReceipt ?? false,
        }, cashChange.changeMinor);
      } catch (receiptError) {
        console.warn('Sale completed, but receipt details could not be prepared:', receiptError);
        refreshWarnings.push('The sale is complete, but its receipt could not be prepared.');
      }
      setPostSaleWarning(refreshWarnings.join(' '));
      setSuccessChangeMinor(cashChange.changeMinor);
      setSaleResult(savedSale);
      setReceiptData(generatedReceipt);
    } catch (saleError) {
      setSubmitError(saleError instanceof Error ? saleError.message : friendlyErrorMessage(saleError));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const closeSale = () => {
    setSaleResult(null);
    setReceiptData(null);
    setPostSaleWarning('');
    setSuccessChangeMinor(0);
    setShowPayment(false);
    setShowCart(false);
    setPaymentAmounts(emptyPaymentAmounts);
    setCustomerSearch('');
    setSubmitError('');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <ScreenHeader
          title="Sell"
          subtitle="Tap a product to add it"
          rightAction={(
            <Pressable onPress={() => router.push('/sales/history')} style={styles.historyAction} accessibilityRole="button">
              <Text style={styles.historyActionText}>History</Text>
            </Pressable>
          )}
        />
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
                  <ProductImage imageUrl={item.image_url} style={styles.productImage} />
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
      <Modal
        visible={showCart}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!submitting) {
            if (showPayment) setShowPayment(false);
            else setShowCart(false);
          }
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => {
              if (!submitting && !cart.locked) setShowCart(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close sale review"
          />
          <View style={styles.cartSheet}>
            {saleResult ? (
              <ScrollView contentContainerStyle={styles.successContent}>
                <Text style={styles.successTitle}>Sale complete</Text>
                <Text style={styles.successReceipt}>Receipt {saleResult.sale.receipt_no}</Text>
                <Text style={styles.successTotal}>{formatSLE(saleResult.sale.total_minor)}</Text>
                <Text style={styles.summaryHeading}>Payment summary</Text>
                {saleResult.payments.map((payment) => (
                  <View key={payment.id || payment.method} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{paymentLabel(payment.method)}</Text>
                    <Text style={styles.summaryValue}>{formatSLE(payment.amount_minor)}</Text>
                  </View>
                ))}
                {saleResult.sale.credit_minor > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Credit balance</Text>
                    <Text style={styles.summaryValue}>{formatSLE(saleResult.sale.credit_minor)}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Change to give back</Text>
                  <Text style={styles.summaryValue}>{formatSLE(successChangeMinor)}</Text>
                </View>
                {postSaleWarning ? <Text style={styles.error}>{postSaleWarning}</Text> : null}
                {receiptData ? <ReceiptActions data={receiptData} cacheKey={`sale/${saleResult.sale.id}`} autoGenerate /> : null}
                <Button label="Done" onPress={closeSale} />
              </ScrollView>
            ) : (
              <>
                <View style={styles.cartHeader}>
                  <View style={styles.cartHeaderText}>
                    <Text style={styles.cartTitle}>{showPayment ? 'Payment' : 'Review sale'}</Text>
                    <Text style={styles.cartSubtitle}>{showPayment ? 'Enter payments and confirm the sale.' : 'Check the items and total.'}</Text>
                  </View>
                  <IconButton
                    icon={X}
                    label="Close sale review"
                    disabled={submitting}
                    onPress={() => {
                      if (showPayment) setShowPayment(false);
                      else setShowCart(false);
                    }}
                  />
                </View>
                {showPayment ? (
                  <ScrollView contentContainerStyle={styles.paymentContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Amount due</Text>
                      <Text style={styles.totalValue}>{formatSLE(cart.totals.total)}</Text>
                    </View>
                    {paymentMethods.map(({ id, label }) => (
                      <View key={id} style={styles.paymentField}>
                        <Text style={styles.paymentLabel}>{label} ({id === 'cash' ? 'amount received' : 'amount'}, {ctx?.business?.currencyCode ?? 'SLE'})</Text>
                        <TextInput
                          value={paymentAmounts[id]}
                          onChangeText={(value) => setPaymentAmounts((current) => ({ ...current, [id]: value }))}
                          editable={!cart.locked}
                          placeholder="0.00"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="decimal-pad"
                          style={styles.paymentInput}
                          accessibilityLabel={label}
                        />
                      </View>
                    ))}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Change to give back</Text>
                      <Text style={styles.summaryValue}>{formatSLE(cashChange.changeMinor)}</Text>
                    </View>
                    {unpaidMinor > 0 ? (
                      <Text style={styles.creditHint}>Unpaid balance: {formatSLE(unpaidMinor)}. Select a customer to record it as credit.</Text>
                    ) : null}
                    <Text style={styles.customerHeading}>Customer {unpaidMinor > 0 ? '(required for credit)' : '(optional)'}</Text>
                    {cart.customer ? (
                      <View style={styles.selectedCustomer}>
                        <View style={styles.customerText}>
                          <Text style={styles.customerName}>{cart.customer.name}</Text>
                          {cart.customer.phone ? <Text style={styles.customerPhone}>{cart.customer.phone}</Text> : null}
                        </View>
                        {!cart.locked ? <Pressable onPress={() => cart.setCustomer(null)}><Text style={styles.clearCustomer}>Remove</Text></Pressable> : null}
                      </View>
                    ) : null}
                    <TextInput
                      value={customerSearch}
                      onChangeText={setCustomerSearch}
                      editable={!cart.locked}
                      placeholder="Search customers"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.customerSearch}
                      accessibilityLabel="Search customers"
                    />
                    {customerLoading ? <Text style={styles.customerNote}>Loading customers…</Text> : null}
                    {customerError ? <Text style={styles.error}>{customerError}</Text> : null}
                    {!customerLoading && !customerError && customerOptions.length === 0
                      ? <Text style={styles.customerNote}>No customers found.</Text>
                      : customerOptions.map((customer) => (
                        <Pressable
                          key={customer.id}
                          disabled={cart.locked}
                          onPress={() => {
                            cart.setCustomer({ id: customer.id, name: customer.name, phone: customer.phone });
                            setCustomerSearch('');
                          }}
                          style={styles.customerOption}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${customer.name}`}
                        >
                          <Text style={styles.customerName}>{customer.name}</Text>
                          {customer.phone ? <Text style={styles.customerPhone}>{customer.phone}</Text> : null}
                        </Pressable>
                      ))}
                    {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
                    <Button
                      label={submitError ? 'Try again' : 'Confirm sale'}
                      onPress={() => void confirmSale()}
                      loading={submitting}
                      disabled={submitting || Boolean(paymentBlockReason)}
                    />
                    {submitting || paymentBlockReason ? (
                      <Text style={styles.inlineReason}>{submitting ? 'Confirming your sale…' : paymentBlockReason}</Text>
                    ) : null}
                    <Button
                      label="Back to review"
                      variant="outline"
                      disabled={submitting}
                      onPress={() => setShowPayment(false)}
                    />
                  </ScrollView>
                ) : (
                  <>
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
                              disabled={cart.locked}
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
                              disabled={cart.locked}
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
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>{formatSLE(cart.totals.subtotal)}</Text>
                      </View>
                      {cart.totals.discount > 0 ? (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Discount</Text>
                          <Text style={styles.summaryValue}>-{formatSLE(cart.totals.discount)}</Text>
                        </View>
                      ) : null}
                    </ScrollView>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>{formatSLE(cart.totals.total)}</Text>
                    </View>
                    <Button
                      label="Continue to payment"
                      disabled={cart.items.length === 0}
                      onPress={() => setShowPayment(true)}
                    />
                    {cart.items.length === 0 ? <Text style={styles.inlineReason}>Your cart is empty.</Text> : null}
                    <Button label="Back to products" variant="outline" onPress={() => setShowCart(false)} />
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  historyAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  historyActionText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
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
  cartSheet: { maxHeight: '90%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, gap: 12 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartHeaderText: { flex: 1 },
  cartTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  cartSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  cartItems: { gap: 8, paddingVertical: 4 },
  paymentContent: { gap: 12, paddingVertical: 4 },
  successContent: { gap: 12, paddingVertical: 8 },
  successTitle: { color: colors.primaryDark, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  successReceipt: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  successTotal: { color: colors.primaryDark, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  summaryHeading: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 6 },
  summaryRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
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
  paymentField: { gap: 6 },
  paymentLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  paymentInput: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 },
  creditHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  customerHeading: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  selectedCustomer: { minHeight: 56, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight },
  customerText: { flex: 1 },
  customerName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  customerPhone: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  clearCustomer: { color: colors.primaryDark, fontSize: 13, fontWeight: '700', padding: 8 },
  customerSearch: { minHeight: 46, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.text },
  customerNote: { color: colors.textSecondary, fontSize: 13, paddingVertical: 6 },
  customerOption: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.white },
  inlineReason: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, marginTop: -4 },
});
