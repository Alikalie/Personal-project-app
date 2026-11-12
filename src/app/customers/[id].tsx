import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, FileText, X } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { Badge, EmptyState, IconButton, ListRow, ScreenHeader, Skeleton } from '@/components/ds';
import { ReceiptActions } from '@/components/receipts/ReceiptActions';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { formatSLE } from '@/lib/money';
import { friendlyErrorMessage } from '@/lib/errors';
import { repaymentReceiptFromLedger } from '@/lib/receipt/buildReceiptData';
import type { ReceiptData } from '@/lib/receipt/types';
import { refreshDashboardViews } from '@/services/dashboardService';
import {
  getCustomer,
  getCustomerLedger,
  getCustomerSummary,
  getRepaymentStatus,
  listCustomers,
  voidRepayment,
  type Customer,
  type CustomerLedgerEntry,
} from '@/services/customerService';
import { listReceiptSales, type SaleHistoryItem } from '@/services/salesService';

const reasonOptions = ['Wrong amount', 'Wrong method', 'Entered twice', 'Other'];

type LedgerLine = CustomerLedgerEntry & { runningBalanceMinor: number };
type LedgerFilter = 'all' | 'changes';
type ProfileTab = 'activity' | 'purchases';

function paymentMethodLabel(method: string | null): string {
  if (method === 'orange_money') return 'Orange Money';
  if (method === 'afrimoney') return 'Afrimoney';
  if (method === 'cash') return 'Cash';
  if (method === 'other') return 'Other';
  return method || 'Unknown method';
}

function dateTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-SL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function reasonFromReversal(entry: CustomerLedgerEntry, ledger: CustomerLedgerEntry[]): string | null {
  const reversal = ledger.find((row) => row.reverses_entry_id === entry.id);
  if (!reversal?.note) return null;
  return reversal.note.replace(/^payment (?:reversed|cancelled):\s*/i, '') || reversal.note;
}

function ledgerLabel(entry: CustomerLedgerEntry): string {
  if (entry.entry_type === 'adjustment' && entry.reverses_entry_id) return 'Payment reversed';
  if (entry.entry_type === 'repayment') return entry.corrects_entry_id ? 'Corrected payment' : 'Payment received';
  if (entry.entry_type === 'sale') return 'Credit sale';
  return entry.entry_type.charAt(0).toLocaleUpperCase() + entry.entry_type.slice(1);
}

export default function CustomerProfile() {
  const { ctx } = useAuth();
  const { id, success } = useLocalSearchParams<{ id: string; success?: string }>();
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const canChangePayments = canEditBusiness(ctx?.business?.role);
  const role = ctx?.business?.role?.toLowerCase();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [profileTab, setProfileTab] = useState<ProfileTab>('activity');
  const [purchases, setPurchases] = useState<SaleHistoryItem[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<CustomerLedgerEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!businessId || !id) {
      setLoading(false);
      setError('Customer details are not available.');
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [profile, entries] = await Promise.all([
        getCustomer(businessId, id),
        getCustomerLedger(businessId, id),
      ]);
      setCustomer(profile);
      setLedger(entries);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, id]);

  const loadPurchases = useCallback(async () => {
    if (!businessId || !id) {
      setPurchasesError('Business details are not available.');
      return;
    }
    setPurchasesLoading(true);
    setPurchasesError('');
    try {
      const result = await listReceiptSales(businessId, { customerId: id });
      setPurchases(result.rows);
    } catch (purchaseError) {
      setPurchasesError(friendlyErrorMessage(purchaseError));
    } finally {
      setPurchasesLoading(false);
    }
  }, [businessId, id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (typeof success === 'string') setSuccessMessage(success);
  }, [success]);

  useEffect(() => {
    if (profileTab === 'purchases') void loadPurchases();
  }, [loadPurchases, profileTab]);

  useEffect(() => {
    if (role === 'cashier' && selectedEntry) {
      setSelectedEntry(null);
    }
  }, [role, selectedEntry]);

  const ledgerLines = useMemo(() => {
    let runningBalanceMinor = 0;
    return ledger.map((entry): LedgerLine => {
      runningBalanceMinor += entry.amount_minor;
      if (!Number.isSafeInteger(runningBalanceMinor)) {
        throw new Error('The customer balance exceeds the supported range.');
      }
      return { ...entry, runningBalanceMinor };
    });
  }, [ledger]);
  const visibleLines = filter === 'changes'
    ? ledgerLines.filter((entry) => (
      entry.entry_type === 'adjustment' && entry.reverses_entry_id !== null
      || entry.corrects_entry_id !== null
      || entry.entry_type === 'repayment' && getRepaymentStatus(entry, ledger) !== 'active'
    ))
    : ledgerLines;
  const balanceMinor = ledgerLines.at(-1)?.runningBalanceMinor ?? 0;
  const replacementFor = selectedEntry
    ? ledger.find((entry) => entry.corrects_entry_id === selectedEntry.id) ?? null
    : null;
  const earlierPayment = selectedEntry?.corrects_entry_id
    ? ledger.find((entry) => entry.id === selectedEntry.corrects_entry_id) ?? null
    : null;
  const selectedStatus = selectedEntry ? getRepaymentStatus(selectedEntry, ledger) : 'active';
  const selectedReason = selectedEntry ? reasonFromReversal(selectedEntry, ledger) : null;
  const selectedReceipt = useMemo<ReceiptData | null>(() => {
    if (!selectedEntry || selectedEntry.entry_type !== 'repayment' || !customer) return null;
    const index = ledger.findIndex((entry) => entry.id === selectedEntry.id);
    if (index < 0) return null;
    const previousBalanceMinor = ledger.slice(0, index).reduce((total, entry) => total + entry.amount_minor, 0);
    try {
      return repaymentReceiptFromLedger({
        entry: selectedEntry,
        previousBalanceMinor,
        customerName: customer.name,
        customerPhone: customer.phone,
        business: {
          name: ctx?.business?.name ?? null,
          address: ctx?.business?.address ?? null,
          phone: ctx?.business?.phone ?? null,
          receipt_header: ctx?.business?.receiptHeader ?? null,
          receipt_footer: ctx?.business?.receiptFooter ?? null,
          show_logo_on_receipt: ctx?.business?.showLogoOnReceipt ?? false,
        },
        cashierName: ctx?.name ?? 'Team member',
      });
    } catch (receiptError) {
      console.warn('Could not prepare payment receipt:', receiptError);
      return null;
    }
  }, [ctx, customer, ledger, selectedEntry]);

  const refreshAfterChange = async (): Promise<void> => {
    if (!businessId || !id) return;
    const warnings: string[] = [];
    try {
      const [profile, entries] = await Promise.all([
        getCustomer(businessId, id),
        getCustomerLedger(businessId, id),
      ]);
      setCustomer(profile);
      setLedger(entries);
    } catch (refreshError) {
      warnings.push(`Profile and activity could not refresh: ${friendlyErrorMessage(refreshError)}`);
    }
    try {
      await Promise.all([listCustomers(businessId), getCustomerSummary(businessId)]);
    } catch (refreshError) {
      warnings.push(`Customer balances could not refresh: ${friendlyErrorMessage(refreshError)}`);
    }
    try {
      await refreshDashboardViews(businessId);
    } catch (refreshError) {
      warnings.push(`Dashboard could not refresh: ${friendlyErrorMessage(refreshError)}`);
    }
    setRefreshWarning(warnings.join(' '));
  };

  const cancelSelectedPayment = async () => {
    if (!businessId || !selectedEntry || cancelling) return;
    setCancelling(true);
    setCancelError('');
    try {
      const newBalance = await voidRepayment({
        entryId: selectedEntry.id,
        businessId,
        reason: cancelReason,
      });
      setSuccessMessage(`Payment cancelled. New balance: ${formatSLE(newBalance)}.`);
      setShowCancel(false);
      setSelectedEntry(null);
      setCancelReason('');
      await refreshAfterChange();
    } catch (cancelFailure) {
      setCancelError(cancelFailure instanceof Error ? cancelFailure.message : friendlyErrorMessage(cancelFailure));
    } finally {
      setCancelling(false);
    }
  };

  const openCancel = () => {
    setCancelError('');
    setCancelReason('');
    setShowCancel(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Customer" onBack={() => router.back()} />
          <Skeleton height={92} radius={16} style={styles.loadingBlock} />
          <Skeleton height={56} radius={12} style={styles.loadingBlock} />
          <Skeleton height={56} radius={12} style={styles.loadingBlock} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !customer) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Customer" onBack={() => router.back()} />
          <EmptyState
            icon={FileText}
            title="Customer unavailable"
            message={error || 'Customer details are not available.'}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Customer profile" subtitle={customer.phone || 'No phone number'} onBack={() => router.back()} />
        <View style={styles.profileHeader}>
          <Text style={styles.customerName}>{customer.name}</Text>
          {customer.address ? <Text style={styles.customerDetail}>{customer.address}</Text> : null}
          <Badge
            label={balanceMinor > 0 ? `Owes ${formatSLE(balanceMinor)}` : 'Settled'}
            tone={balanceMinor > 0 ? 'danger' : 'neutral'}
          />
        </View>
        {balanceMinor > 0 ? (
          <Button
            label="Record repayment"
            onPress={() => router.push({ pathname: '/customers/repay', params: { customerId: customer.id } })}
          />
        ) : null}
        {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}
        {refreshWarning ? <Text style={styles.warningMessage}>{refreshWarning}</Text> : null}
        <View style={styles.activityHeader}>
          <View style={styles.profileTabs}>
            <Pressable
              onPress={() => setProfileTab('activity')}
              style={[styles.profileTab, profileTab === 'activity' && styles.profileTabSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: profileTab === 'activity' }}
            >
              <Text style={[styles.filterText, profileTab === 'activity' && styles.filterTextSelected]}>Money activity</Text>
            </Pressable>
            <Pressable
              onPress={() => setProfileTab('purchases')}
              style={[styles.profileTab, profileTab === 'purchases' && styles.profileTabSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: profileTab === 'purchases' }}
            >
              <Text style={[styles.filterText, profileTab === 'purchases' && styles.filterTextSelected]}>Purchases</Text>
            </Pressable>
          </View>
          <Text style={styles.balanceText}>Balance {formatSLE(balanceMinor)}</Text>
        </View>
        {profileTab === 'activity' ? <View style={styles.filters}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterChip, filter === 'all' && styles.filterChipSelected]}
            accessibilityRole="button"
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextSelected]}>All activity</Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('changes')}
            style={[styles.filterChip, filter === 'changes' && styles.filterChipSelected]}
            accessibilityRole="button"
          >
            <Text style={[styles.filterText, filter === 'changes' && styles.filterTextSelected]}>Changes</Text>
          </Pressable>
        </View> : null}
        {profileTab === 'activity' ? <ScrollView
          contentContainerStyle={styles.activityList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        >
          {visibleLines.length === 0 ? (
            <Text style={styles.emptyActivity}>
              {filter === 'changes' ? 'No payment changes yet.' : 'No money activity yet.'}
            </Text>
          ) : visibleLines.map((entry) => {
            const status = getRepaymentStatus(entry, ledger);
            const isReversal = entry.entry_type === 'adjustment' && entry.reverses_entry_id !== null;
            const changed = entry.entry_type === 'repayment' && status !== 'active';
            const tag = isReversal ? 'Reversed' : status === 'corrected' ? 'Corrected' : status === 'cancelled' ? 'Cancelled' : null;
            return (
              <Pressable
                key={entry.id}
                onPress={() => {
                  setSelectedEntry(entry);
                  setSuccessMessage('');
                  setRefreshWarning('');
                }}
                style={styles.activityRow}
                accessibilityRole="button"
                accessibilityLabel={`${ledgerLabel(entry)}, ${formatSLE(entry.amount_minor)}, ${dateTimeLabel(entry.created_at)}`}
              >
                {entry.amount_minor < 0
                  ? <ArrowDownLeft size={18} color={changed || isReversal ? colors.textSecondary : colors.primary} />
                  : <ArrowUpRight size={18} color={isReversal ? colors.textSecondary : colors.primary} />}
                <View style={styles.activityText}>
                  <Text style={[styles.activityTitle, (changed || isReversal) && styles.muted]}>{ledgerLabel(entry)}</Text>
                  <Text style={styles.activitySubtitle}>{dateTimeLabel(entry.created_at)}</Text>
                  {entry.note ? <Text style={styles.activityNote} numberOfLines={2}>{entry.note}</Text> : null}
                  {tag ? <Badge label={tag} tone="neutral" /> : null}
                </View>
                <View style={styles.activityAmounts}>
                  <Text style={[
                    styles.activityAmount,
                    (changed || isReversal) && styles.muted,
                    changed && styles.struck,
                  ]}>
                    {formatSLE(entry.amount_minor)}
                  </Text>
                  <Text style={styles.runningBalance}>Balance {formatSLE(entry.runningBalanceMinor)}</Text>
                </View>
              </Pressable>
            );
          })}
          {ledger.length > 0 ? (
            <Text style={styles.statementNote}>This statement includes every ledger entry, including reversals and corrections.</Text>
          ) : null}
        </ScrollView> : (
          <View style={styles.purchaseList}>
            {purchasesLoading ? (
              <View style={styles.purchaseSkeletons}>
                <Skeleton height={72} radius={14} />
                <Skeleton height={72} radius={14} />
              </View>
            ) : purchasesError ? (
              <EmptyState icon={FileText} title="Purchases unavailable" message={purchasesError} actionLabel="Try again" onAction={() => void loadPurchases()} />
            ) : purchases.length === 0 ? (
              <EmptyState icon={FileText} title="No purchases yet" message="Sales linked to this customer will appear here." />
            ) : purchases.map((sale) => (
              <ListRow
                key={sale.id}
                icon={FileText}
                title={`Receipt ${sale.receiptNo}`}
                subtitle={dateTimeLabel(sale.soldAt)}
                trailingValue={formatSLE(sale.totalMinor)}
                chevron
                onPress={() => router.push({ pathname: '/sales/receipt/[id]', params: { id: sale.id } })}
              />
            ))}
          </View>
        )}
      </View>

      <Modal visible={selectedEntry !== null} transparent animationType="slide" onRequestClose={() => setSelectedEntry(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setSelectedEntry(null)} accessibilityRole="button" accessibilityLabel="Close payment details" />
          <ScrollView style={styles.detailSheet} contentContainerStyle={styles.detailScroll}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Payment details</Text>
                <Text style={styles.modalSubtitle}>{selectedEntry ? dateTimeLabel(selectedEntry.created_at) : ''}</Text>
              </View>
              <IconButton icon={X} label="Close payment details" onPress={() => setSelectedEntry(null)} />
            </View>
            {selectedEntry ? (
              <>
                <Text style={[styles.detailAmount, selectedEntry.entry_type === 'adjustment' && styles.muted]}>
                  {formatSLE(Math.abs(selectedEntry.amount_minor))}
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Activity</Text>
                  <Text style={styles.detailValue}>{ledgerLabel(selectedEntry)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValue}>{paymentMethodLabel(selectedEntry.method)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Note</Text>
                  <Text style={styles.detailValue}>{selectedEntry.note || 'No note'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recorded by</Text>
                  <Text style={styles.detailValue}>{selectedEntry.created_by_name || 'Team member'}</Text>
                </View>
                {selectedEntry.entry_type === 'repayment' ? (
                  <View style={styles.detailStatus}>
                    <Badge
                      label={selectedStatus === 'active' ? 'Active' : selectedStatus === 'corrected' ? 'Corrected' : 'Cancelled'}
                      tone={selectedStatus === 'active' ? 'success' : 'neutral'}
                    />
                  </View>
                ) : null}
                {selectedReason ? <Text style={styles.reasonText}>Reason: {selectedReason}</Text> : null}
                {replacementFor ? (
                  <ListRow
                    title="Replacement payment"
                    subtitle={`${formatSLE(Math.abs(replacementFor.amount_minor))} · ${paymentMethodLabel(replacementFor.method)}`}
                    chevron
                    onPress={() => setSelectedEntry(replacementFor)}
                  />
                ) : null}
                {earlierPayment ? (
                  <ListRow
                    title="Corrects an earlier payment"
                    subtitle={`${formatSLE(Math.abs(earlierPayment.amount_minor))} · ${paymentMethodLabel(earlierPayment.method)}`}
                    chevron
                    onPress={() => setSelectedEntry(earlierPayment)}
                  />
                ) : null}
                {selectedEntry.entry_type === 'repayment' && selectedStatus === 'active' && canChangePayments ? (
                  <>
                    <Button
                      label="Edit payment"
                      onPress={() => {
                        setSelectedEntry(null);
                        router.push({
                          pathname: '/customers/edit-payment/[entryId]',
                          params: { entryId: selectedEntry.id, customerId: customer.id },
                        });
                      }}
                    />
                    <Pressable
                      onPress={openCancel}
                      style={styles.cancelAction}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel payment"
                    >
                      <Text style={styles.cancelActionText}>Cancel payment</Text>
                    </Pressable>
                  </>
                ) : null}
                {selectedReceipt ? (
                  <ReceiptActions data={selectedReceipt} cacheKey={`repayment/${selectedEntry.id}`} autoGenerate={false} />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showCancel}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancelling) setShowCancel(false);
        }}
      >
        <View style={styles.confirmRoot}>
          <Pressable
            style={styles.scrim}
            onPress={() => {
              if (!cancelling) setShowCancel(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close cancel payment"
          />
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Cancel payment</Text>
            <Text style={styles.confirmText}>
              Cancel this {selectedEntry ? formatSLE(Math.abs(selectedEntry.amount_minor)) : formatSLE(0)} payment? The customer will owe {selectedEntry ? formatSLE(Math.abs(selectedEntry.amount_minor)) : formatSLE(0)} more.
            </Text>
            <Text style={styles.fieldLabel}>Reason for cancellation</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Enter a reason"
              placeholderTextColor={colors.textSecondary}
              style={styles.reasonInput}
              accessibilityLabel="Reason for cancellation"
            />
            <View style={styles.reasonChoices}>
              {reasonOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setCancelReason(option)}
                  style={[styles.reasonChip, cancelReason === option && styles.reasonChipSelected]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.reasonChipText, cancelReason === option && styles.reasonChipTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
            <Button
              label="Confirm cancellation"
              onPress={() => void cancelSelectedPayment()}
              loading={cancelling}
              disabled={cancelling || cancelReason.trim().length < 3}
            />
            {cancelReason.trim().length < 3 ? <Text style={styles.reasonHint}>Please give a reason of at least 3 characters.</Text> : null}
            <Button label="Keep payment" variant="outline" disabled={cancelling} onPress={() => setShowCancel(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.five, paddingBottom: Spacing.two },
  loadingBlock: { marginTop: Spacing.three },
  profileHeader: { gap: Spacing.two, paddingVertical: Spacing.four },
  customerName: { color: colors.text, ...typography.heading },
  customerDetail: { color: colors.textSecondary, ...typography.body },
  successMessage: { color: colors.success, ...typography.label, marginBottom: Spacing.two },
  warningMessage: { color: colors.warning, ...typography.caption, marginBottom: Spacing.two },
  activityHeader: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  profileTabs: { flexDirection: 'row', flex: 1, gap: Spacing.two },
  profileTab: { minHeight: 42, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  profileTabSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  sectionTitle: { color: colors.text, ...typography.heading, flexShrink: 1 },
  balanceText: { color: colors.textSecondary, ...typography.caption, flexShrink: 1, textAlign: 'right' },
  filters: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  filterChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterChipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, ...typography.label },
  filterTextSelected: { color: colors.primaryDark },
  activityList: { gap: Spacing.two, paddingVertical: Spacing.two, paddingBottom: 24 },
  purchaseList: { flex: 1, gap: Spacing.two, paddingVertical: Spacing.two },
  purchaseSkeletons: { gap: Spacing.two, paddingTop: Spacing.three },
  activityRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: radius.md, backgroundColor: colors.white },
  activityText: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: { color: colors.text, ...typography.label },
  activitySubtitle: { color: colors.textSecondary, ...typography.caption },
  activityNote: { color: colors.textSecondary, ...typography.caption },
  activityAmount: { color: colors.text, ...typography.label, textAlign: 'right', flexShrink: 0 },
  activityAmounts: { alignItems: 'flex-end', flexShrink: 0 },
  runningBalance: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  muted: { color: colors.textSecondary },
  struck: { textDecorationLine: 'line-through' },
  emptyActivity: { color: colors.textSecondary, ...typography.body, textAlign: 'center', paddingVertical: Spacing.seven },
  statementNote: { color: colors.textSecondary, ...typography.caption, textAlign: 'center', paddingVertical: Spacing.three },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailSheet: { maxHeight: '90%', paddingHorizontal: Spacing.five, paddingTop: Spacing.five, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  detailScroll: { gap: Spacing.three, paddingBottom: Spacing.six },
  modalHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  modalTitleGroup: { flex: 1 },
  modalTitle: { color: colors.text, ...typography.heading },
  modalSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  detailAmount: { color: colors.primaryDark, fontSize: 28, fontWeight: '800', textAlign: 'center', paddingVertical: Spacing.two },
  detailRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  detailLabel: { color: colors.textSecondary, ...typography.body },
  detailValue: { color: colors.text, ...typography.label, flex: 1, textAlign: 'right' },
  detailStatus: { alignItems: 'flex-start' },
  reasonText: { color: colors.textSecondary, ...typography.body },
  cancelAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelActionText: { color: colors.danger, ...typography.label },
  confirmRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.five },
  confirmSheet: { padding: Spacing.five, borderRadius: radius.xl, backgroundColor: colors.white, gap: Spacing.three },
  confirmTitle: { color: colors.text, ...typography.heading },
  confirmText: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  fieldLabel: { color: colors.text, ...typography.label },
  reasonInput: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: Spacing.three, color: colors.text, ...typography.body },
  reasonChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  reasonChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl },
  reasonChipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  reasonChipText: { color: colors.textSecondary, ...typography.caption },
  reasonChipTextSelected: { color: colors.primaryDark },
  reasonHint: { color: colors.textSecondary, ...typography.caption, textAlign: 'center', marginTop: -Spacing.two },
  errorText: { color: colors.danger, ...typography.caption },
});
