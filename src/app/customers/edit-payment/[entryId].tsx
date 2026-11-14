import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { ScreenHeader } from '@/components/ds';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { currencyFractionDigits, formatSLE, parseMoneyToMinorUnits } from '@/lib/money';
import { canEditBusiness } from '@/lib/permissions';
import { newId } from '@/lib/uuid';
import { refreshDashboardViews } from '@/services/dashboardService';
import {
  editRepayment,
  getCustomer,
  getCustomerLedger,
  getCustomerLedgerEntry,
  getCustomerSummary,
  getRepaymentStatus,
  listCustomers,
  type Customer,
  type CustomerLedgerEntry,
} from '@/services/customerService';
import type { PaymentMethod } from '@/services/salesService';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'afrimoney', label: 'Afrimoney' },
  { value: 'other', label: 'Other' },
];
const reasonOptions = ['Wrong amount', 'Wrong method', 'Entered twice', 'Other'];

function amountInput(minor: number, currencyCode: string): string {
  const digits = currencyFractionDigits(currencyCode);
  const absolute = BigInt(Math.abs(minor));
  const factor = 10n ** BigInt(digits);
  const major = String(absolute / factor);
  const fraction = digits ? String(absolute % factor).padStart(digits, '0') : '';
  return `${major}${fraction ? `.${fraction}` : ''}`;
}

function methodName(method: string | null): string {
  return methods.find((item) => item.value === method)?.label ?? method ?? 'Other';
}

export default function EditPayment() {
  const { ctx } = useAuth();
  const { entryId, customerId } = useLocalSearchParams<{ entryId: string; customerId?: string }>();
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const allowed = canEditBusiness(ctx?.business?.role);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entry, setEntry] = useState<CustomerLedgerEntry | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [baseBalanceMinor, setBaseBalanceMinor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const newIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId || !entryId || !allowed) {
      setLoading(false);
      if (!allowed) router.replace('/(tabs)/customers');
      else setError('Payment details are not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payment = await getCustomerLedgerEntry(businessId, entryId);
      if (customerId && payment.customer_id !== customerId) throw new Error('Payment not found.');
      const ledger = await getCustomerLedger(businessId, payment.customer_id);
      if (payment.entry_type !== 'repayment') throw new Error('Only payments can be edited.');
      if (getRepaymentStatus(payment, ledger) !== 'active') {
        throw new Error('This payment was already changed.');
      }
      const paymentCustomer = await getCustomer(businessId, payment.customer_id);
      const fullBalance = ledger.reduce((total, row) => total + row.amount_minor, 0);
      const baseBalance = fullBalance - payment.amount_minor;
      if (!Number.isSafeInteger(baseBalance)) throw new Error('The customer balance exceeds the supported range.');
      setCustomer(paymentCustomer);
      setEntry(payment);
      setAmount(amountInput(Math.abs(payment.amount_minor), ctx?.business?.currencyCode ?? 'SLE'));
      setMethod(methods.some((item) => item.value === payment.method)
        ? payment.method as PaymentMethod
        : 'other');
      setNote(payment.note ?? '');
      setBaseBalanceMinor(baseBalance);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [allowed, businessId, customerId, ctx?.business?.currencyCode, entryId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!ctx?.business?.role) return;
    if (!allowed) router.replace('/(tabs)/customers');
  }, [allowed, ctx?.business?.role]);

  const parsedAmount = useMemo(() => {
    try {
      return { value: amount.trim() ? parseMoneyToMinorUnits(amount) : null, error: '' };
    } catch {
      return { value: null, error: 'Enter a valid payment amount.' };
    }
  }, [amount]);
  const newBalanceMinor = parsedAmount.value === null
    ? baseBalanceMinor
    : baseBalanceMinor - parsedAmount.value;
  const changed = Boolean(entry && parsedAmount.value !== null && (
    parsedAmount.value !== Math.abs(entry.amount_minor)
    || method !== entry.method
    || note.trim() !== (entry.note ?? '').trim()
  ));
  const blockReason = !entry
    ? 'Payment details are not available.'
    : parsedAmount.error
      ? parsedAmount.error
      : parsedAmount.value === null || parsedAmount.value <= 0
        ? 'Enter an amount greater than zero.'
        : parsedAmount.value > baseBalanceMinor
          ? 'That payment is more than the customer owes.'
          : !changed
            ? 'Change the amount, method or note before saving.'
            : reason.trim().length < 3
              ? 'Please give a reason.'
              : '';

  const saveCorrection = async () => {
    if (!businessId || !customer || !entry || parsedAmount.value === null || blockReason || submitting) return;
    if (!newIdRef.current) newIdRef.current = newId();
    setSubmitting(true);
    setError('');
    try {
      const newBalance = await editRepayment({
        entryId: entry.id,
        newId: newIdRef.current,
        businessId,
        newAmountMinor: parsedAmount.value,
        method,
        note: note.trim() || null,
        reason,
      });
      let success = `Payment corrected. New balance: ${formatSLE(newBalance)}.`;
      try {
        const [profile, customerLedger, customerList, summary] = await Promise.all([
          getCustomer(businessId, customer.id),
          getCustomerLedger(businessId, customer.id),
          listCustomers(businessId),
          getCustomerSummary(businessId),
        ]);
        if (
          !profile
          || !customerLedger
          || !customerList
          || !Number.isSafeInteger(summary.totalOwedMinor)
        ) {
          throw new Error('Customer data could not refresh.');
        }
        await refreshDashboardViews(businessId);
      } catch {
        success += ' Some balances could not refresh; pull to refresh.';
      }
      router.replace({
        pathname: '/customers/[id]',
        params: { id: customer.id, success },
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : friendlyErrorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Edit payment" onBack={() => router.back()} />
        {loading ? (
          <Text style={styles.statusText}>Loading payment…</Text>
        ) : error && !entry ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : entry && customer ? (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.balanceCaption}>Balance owed excluding this payment</Text>
            <Text style={styles.baseBalance}>{formatSLE(baseBalanceMinor)}</Text>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              style={styles.input}
              accessibilityLabel="New payment amount"
            />
            <Text style={styles.fieldLabel}>Method</Text>
            <View style={styles.methodTiles}>
              {methods.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setMethod(item.value)}
                  style={[styles.methodTile, method === item.value && styles.methodTileSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: method === item.value }}
                >
                  <Text style={[styles.methodText, method === item.value && styles.methodTextSelected]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              accessibilityLabel="Payment note"
            />
            <Text style={styles.fieldLabel}>Reason for change *</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Enter a reason"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              accessibilityLabel="Reason for change"
            />
            <View style={styles.reasonChoices}>
              {reasonOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setReason(option)}
                  style={[styles.reasonChip, reason === option && styles.reasonChipSelected]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.reasonChipText, reason === option && styles.reasonChipTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Correction summary</Text>
              <Text style={styles.summaryText}>
                Old payment: {formatSLE(Math.abs(entry.amount_minor))} {methodName(entry.method)}.
              </Text>
              <Text style={styles.summaryText}>
                New payment: {formatSLE(parsedAmount.value ?? 0)} {methodName(method)}.
              </Text>
              <Text style={styles.summaryText}>New balance: {formatSLE(newBalanceMinor)}.</Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              label="Save correction"
              onPress={() => void saveCorrection()}
              loading={submitting}
              disabled={submitting || Boolean(blockReason)}
            />
            {submitting || blockReason ? (
              <Text style={styles.reasonHint}>{submitting ? 'Saving correction…' : blockReason}</Text>
            ) : null}
          </ScrollView>
        ) : (
          <Text style={styles.statusText}>Payment details are not available.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.five, paddingBottom: Spacing.two },
  form: { gap: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.seven },
  customerName: { color: colors.text, ...typography.heading },
  balanceCaption: { color: colors.textSecondary, ...typography.caption },
  baseBalance: { color: colors.primaryDark, fontSize: 22, fontWeight: '800', marginTop: -Spacing.two },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: -Spacing.two },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: Spacing.three, backgroundColor: colors.white, color: colors.text, ...typography.body },
  methodTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  methodTile: { minHeight: 48, minWidth: '47%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  methodTileSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  methodText: { color: colors.textSecondary, ...typography.label, textAlign: 'center' },
  methodTextSelected: { color: colors.primaryDark },
  reasonChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  reasonChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  reasonChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  reasonChipText: { color: colors.textSecondary, ...typography.caption },
  reasonChipTextSelected: { color: colors.primaryDark },
  summary: { padding: Spacing.three, borderRadius: radius.md, backgroundColor: colors.white, gap: Spacing.two },
  summaryTitle: { color: colors.text, ...typography.label },
  summaryText: { color: colors.textSecondary, ...typography.body, lineHeight: 21 },
  reasonHint: { color: colors.textSecondary, ...typography.caption, textAlign: 'center', marginTop: -Spacing.two },
  errorText: { color: colors.danger, ...typography.body },
  statusText: { color: colors.textSecondary, ...typography.body, paddingTop: Spacing.five },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  retryText: { color: colors.primaryDark, ...typography.label },
});
