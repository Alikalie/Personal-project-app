import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleDollarSign } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { ReceiptActions } from '@/components/receipts/ReceiptActions';
import { Button } from '@/components/ui';
import { EmptyState, ScreenHeader, Skeleton } from '@/components/ds';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE, parseSLEToMinorUnits } from '@/lib/money';
import { buildRepaymentReceiptData } from '@/lib/receipt/buildReceiptData';
import type { ReceiptData } from '@/lib/receipt/types';
import { newId } from '@/lib/uuid';
import { refreshDashboardViews } from '@/services/dashboardService';
import {
  getCustomer,
  getCustomerBalance,
  getCustomerSummary,
  listCustomers,
  recordRepayment,
  type Customer,
} from '@/services/customerService';
import type { PaymentMethod } from '@/services/salesService';

const methods: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'afrimoney', label: 'Afrimoney' },
  { id: 'other', label: 'Other' },
];

// Enum examples: Cash -> "cash"; Orange Money -> "orange_money"; Afrimoney -> "afrimoney"; Other -> "other".

function amountInput(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

function amountError(value: string, balanceMinor: number): { amountMinor: number | null; reason: string } {
  const input = value.trim();
  if (!input) return { amountMinor: null, reason: 'Enter an amount.' };
  if (/^-/.test(input)) return { amountMinor: null, reason: 'Enter an amount greater than zero.' };
  try {
    const amountMinor = parseSLEToMinorUnits(input);
    if (amountMinor <= 0) return { amountMinor: null, reason: 'Enter an amount greater than zero.' };
    if (amountMinor > balanceMinor) {
      return { amountMinor, reason: 'Amount is more than the balance owed.' };
    }
    return { amountMinor, reason: '' };
  } catch {
    return { amountMinor: null, reason: 'Enter a valid amount, for example 25.50.' };
  }
}

export default function RepayCustomer() {
  const { ctx } = useAuth();
  const params = useLocalSearchParams<{ customerId?: string; id?: string }>();
  const customerId = params.customerId ?? params.id ?? '';
  const business = ctx?.business;
  const businessId = business?.id ?? ctx?.businessId ?? null;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [technicalError, setTechnicalError] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [paidMinor, setPaidMinor] = useState(0);
  const attempt = useRef<{ id: string; fingerprint: string } | null>(null);
  const submitLock = useRef(false);

  const load = useCallback(async () => {
    if (!businessId || !customerId) {
      setLoading(false);
      setError(!businessId ? 'Business details are missing.' : 'Customer details are missing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [profile, liveBalance] = await Promise.all([
        getCustomer(businessId, customerId),
        getCustomerBalance(customerId),
      ]);
      if (liveBalance < 0) throw new Error('The customer balance is invalid.');
      setCustomer(profile);
      setBalanceMinor(liveBalance);
    } catch (loadError) {
      console.warn('Could not load repayment details:', loadError);
      setError(friendlyErrorMessage(loadError, 'repayment-record'));
    } finally {
      setLoading(false);
    }
  }, [businessId, customerId]);

  useFocusEffect(useCallback(() => {
    if (!receipt) void load();
  }, [load, receipt]));

  const parsed = useMemo(() => amountError(amount, balanceMinor), [amount, balanceMinor]);
  const nextBalance = parsed.amountMinor !== null && parsed.reason === ''
    ? balanceMinor - parsed.amountMinor
    : balanceMinor;
  const disabledReason = !businessId
    ? 'Business details are missing.'
    : !customerId
      ? 'Customer details are missing.'
      : balanceMinor <= 0
        ? 'Nothing owed.'
        : parsed.reason || (!method ? 'Choose a payment method.' : '');

  const refreshAfterPayment = async () => {
    if (!businessId || !customerId) return;
    const warnings: string[] = [];
    try {
      const [profile, liveBalance] = await Promise.all([
        getCustomer(businessId, customerId),
        getCustomerBalance(customerId),
      ]);
      setCustomer(profile);
      setBalanceMinor(liveBalance);
    } catch (refreshError) {
      warnings.push(`Customer profile could not refresh: ${friendlyErrorMessage(refreshError)}.`);
    }
    try {
      await Promise.all([listCustomers(businessId), getCustomerSummary(businessId)]);
    } catch (refreshError) {
      warnings.push(`Customer balances could not refresh: ${friendlyErrorMessage(refreshError)}.`);
    }
    try {
      await refreshDashboardViews(businessId);
    } catch (refreshError) {
      warnings.push(`Dashboard could not refresh: ${friendlyErrorMessage(refreshError)}.`);
    }
    setRefreshWarning(warnings.join(' '));
  };

  const submit = async () => {
    if (submitLock.current || disabledReason || !businessId || !customerId || parsed.amountMinor === null) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    setTechnicalError('');
    setShowTechnical(false);
    const fingerprint = JSON.stringify([
      businessId,
      customerId,
      parsed.amountMinor,
      method,
      note.trim(),
    ]);
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
      attempt.current = { id: newId(), fingerprint };
    }
    const attemptId = attempt.current.id;
    try {
      const newBalance = await recordRepayment({
        id: attemptId,
        businessId,
        customerId,
        amountMinor: parsed.amountMinor,
        method,
        note: note.trim() || null,
      });
      setPaidMinor(parsed.amountMinor);
      setReceipt(buildRepaymentReceiptData({
        entryId: attemptId,
        createdAt: new Date().toISOString(),
        business: {
          name: business?.name ?? null,
          address: business?.address ?? null,
          phone: business?.phone ?? null,
          receipt_header: business?.receiptHeader ?? null,
          receipt_footer: business?.receiptFooter ?? null,
          show_logo_on_receipt: business?.showLogoOnReceipt ?? false,
        },
        cashierName: ctx?.name ?? 'Team member',
        customerName: customer?.name ?? 'Customer',
        customerPhone: customer?.phone ?? null,
        amountMinor: parsed.amountMinor,
        method,
        note: note.trim() || null,
        previousBalanceMinor: balanceMinor,
        newBalanceMinor: newBalance,
      }));
      attempt.current = null;
      await refreshAfterPayment();
    } catch (failure) {
      console.warn('Repayment failed:', failure);
      setError(friendlyErrorMessage(failure, 'repayment-record'));
      setTechnicalError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Record repayment" onBack={() => router.back()} />
          <Skeleton height={92} radius={14} />
          <Skeleton height={54} radius={14} />
          <Skeleton height={48} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Record repayment" onBack={() => router.back()} />
          <EmptyState icon={CircleDollarSign} title="Repayment unavailable" message={error} actionLabel="Try again" onAction={() => void load()} />
        </View>
      </SafeAreaView>
    );
  }

  if (receipt) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Payment received" onBack={() => router.back()} />
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.successTitle}>Payment recorded</Text>
            <Text style={styles.successValue}>{formatSLE(paidMinor)}</Text>
            <Text style={styles.successInfo}>New balance: {formatSLE(receipt.kind === 'repayment' ? receipt.newBalanceMinor : 0)}</Text>
            {refreshWarning ? <Text style={styles.warning}>{refreshWarning}</Text> : null}
            <ReceiptActions data={receipt} cacheKey={`repayment/${receipt.kind === 'repayment' ? receipt.entryId : ''}`} autoGenerate />
            <Button label="Done" variant="outline" onPress={() => router.back()} />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Record repayment" subtitle={customer?.name} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.balanceBlock}>
            <Text style={styles.fieldLabel}>Balance owed</Text>
            <Text style={styles.balanceValue}>{formatSLE(balanceMinor)}</Text>
          </View>
          {balanceMinor <= 0 ? <Text style={styles.inlineReason}>Nothing owed.</Text> : null}
          <Text style={styles.fieldLabel}>Amount paid</Text>
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              if (attempt.current) attempt.current = null;
            }}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            editable={!submitting}
            style={styles.amountInput}
            accessibilityLabel="Amount paid"
          />
          {parsed.reason ? <Text style={styles.inlineReason}>{parsed.reason}</Text> : null}
          <View style={styles.quickChoices}>
            <Pressable
              onPress={() => setAmount(amountInput(balanceMinor))}
              disabled={balanceMinor <= 0 || submitting}
              style={styles.quickChoice}
              accessibilityRole="button"
            >
              <Text style={styles.quickChoiceText}>Pay full balance</Text>
            </Pressable>
            <Pressable
              onPress={() => setAmount(amountInput(Math.floor(balanceMinor / 2)))}
              disabled={balanceMinor <= 0 || submitting}
              style={styles.quickChoice}
              accessibilityRole="button"
            >
              <Text style={styles.quickChoiceText}>Half</Text>
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>Payment method</Text>
          <View style={styles.methodGrid}>
            {methods.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setMethod(item.id);
                  if (attempt.current) attempt.current = null;
                }}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ selected: method === item.id }}
                style={[styles.methodTile, method === item.id && styles.methodTileSelected]}
              >
                <Text style={[styles.methodText, method === item.id && styles.methodTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={(value) => {
              setNote(value);
              if (attempt.current) attempt.current = null;
            }}
            placeholder="Add a note"
            placeholderTextColor={colors.textSecondary}
            editable={!submitting}
            style={styles.noteInput}
            multiline
            accessibilityLabel="Payment note"
          />
          <View style={styles.balanceRow}>
            <Text style={styles.fieldLabel}>New balance</Text>
            <Text style={styles.balancePreview}>{formatSLE(nextBalance)}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {error && __DEV__ && technicalError ? (
            <>
              <Pressable onPress={() => setShowTechnical((value) => !value)} accessibilityRole="button">
                <Text style={styles.technicalToggle}>{showTechnical ? 'Hide technical details' : 'Technical details'}</Text>
              </Pressable>
              {showTechnical ? <Text style={styles.technical}>{technicalError}</Text> : null}
            </>
          ) : null}
          <Button
            label={error ? 'Try again' : 'Confirm payment'}
            onPress={() => void submit()}
            loading={submitting}
            disabled={submitting || Boolean(disabledReason)}
          />
          {disabledReason ? <Text style={styles.inlineReason}>{disabledReason}</Text> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  scroll: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: 28 },
  balanceBlock: { padding: Spacing.four, borderRadius: radius.md, backgroundColor: colors.white, gap: Spacing.one },
  fieldLabel: { color: colors.textSecondary, ...typography.label },
  balanceValue: { color: colors.text, ...typography.heading },
  amountInput: { minHeight: 54, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, color: colors.text, fontSize: 20, fontWeight: '700' },
  quickChoices: { flexDirection: 'row', gap: Spacing.two },
  quickChoice: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primaryLight },
  quickChoiceText: { color: colors.primaryDark, ...typography.label },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  methodTile: { minHeight: 48, minWidth: '47%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  methodTileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methodText: { color: colors.textSecondary, ...typography.label },
  methodTextSelected: { color: colors.primaryDark },
  noteInput: { minHeight: 72, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, color: colors.text, textAlignVertical: 'top' },
  balanceRow: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  balancePreview: { color: colors.primaryDark, ...typography.label },
  inlineReason: { color: colors.danger, ...typography.caption },
  error: { color: colors.danger, ...typography.caption },
  technicalToggle: { color: colors.textSecondary, ...typography.caption, textDecorationLine: 'underline' },
  technical: { color: colors.textSecondary, ...typography.caption },
  warning: { color: colors.warning, ...typography.caption },
  successTitle: { color: colors.success, ...typography.heading, textAlign: 'center' },
  successValue: { color: colors.primaryDark, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  successInfo: { color: colors.textSecondary, ...typography.body, textAlign: 'center' },
});
