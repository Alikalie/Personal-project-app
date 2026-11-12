import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CircleDollarSign, Search, UserPlus, Users, X } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { Chip, EmptyState, FAB, IconButton, ListRow, ScreenHeader, Skeleton } from '@/components/ds';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { createCustomer, getCustomerSummary, listCustomers, type Customer } from '@/services/customerService';

type CustomerFilter = 'all' | 'owes' | 'settled';

export default function Customers() {
  const { ctx } = useAuth();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const businessId = ctx?.businessId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState({ customerCount: 0, totalOwedMinor: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!businessId) {
      setLoading(false);
      setError('Your business details are not available. Please sign in again.');
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [customerList, customerSummary] = await Promise.all([
        listCustomers(businessId, debouncedSearch),
        getCustomerSummary(businessId),
      ]);
      setCustomers(customerList);
      setSummary(customerSummary);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (add === '1') {
      setShowAddForm(true);
      router.setParams({ add: undefined });
    }
  }, [add]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const visibleCustomers = useMemo(() => customers.filter((customer) => {
    const balance = customer.balance_minor ?? 0;
    if (filter === 'owes') return balance > 0;
    if (filter === 'settled') return balance <= 0;
    return true;
  }), [customers, filter]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setFormError('');
  };

  const submitCustomer = async () => {
    if (!businessId) {
      setFormError('Your business details are not available. Please sign in again.');
      return;
    }
    if (!name.trim()) {
      setFormError('Enter the customer’s name.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createCustomer(businessId, name, phone, address, notes);
      setShowAddForm(false);
      resetForm();
      setSearch('');
      setDebouncedSearch('');
      setFilter('all');
      await load();
    } catch (saveError) {
      setFormError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const balance = item.balance_minor ?? 0;
    return (
      <ListRow
        leadingLabel={initials(item.name)}
        title={item.name}
        subtitle={item.phone || 'No phone number'}
        badge={{
          label: balance > 0 ? `Owes ${formatSLE(balance)}` : 'Settled',
          tone: balance > 0 ? 'danger' : 'neutral',
        }}
        chevron
        onPress={() => router.push({ pathname: '/customers/[id]', params: { id: item.id } })}
        accessibilityLabel={`${item.name}, ${item.phone || 'no phone number'}, ${balance > 0 ? `owes ${formatSLE(balance)}` : 'settled'}. View customer details`}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Customers" subtitle="People who buy from your business" />

        <View style={styles.summaryLine} accessibilityRole="text" accessibilityLabel={`${formatSLE(summary.totalOwedMinor)} owed by ${summary.customerCount} customers`}>
          <CircleDollarSign size={19} color={summary.totalOwedMinor > 0 ? colors.danger : colors.textSecondary} />
          <Text style={[styles.summaryText, summary.totalOwedMinor === 0 && styles.summarySettled]}>
            {formatSLE(summary.totalOwedMinor)} owed by {summary.customerCount} {summary.customerCount === 1 ? 'customer' : 'customers'}
          </Text>
        </View>

        <View style={styles.search}>
          <Search size={19} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search customers by name or phone"
          />
          {search.length > 0 ? (
            <IconButton icon={X} label="Clear customer search" onPress={() => setSearch('')} />
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
          accessibilityLabel="Customer filters"
        >
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Owes money" selected={filter === 'owes'} onPress={() => setFilter('owes')} />
          <Chip label="Settled" selected={filter === 'settled'} onPress={() => setFilter('settled')} />
        </ScrollView>

        {error ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading customers">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={72} radius={16} />)}
          </View>
        ) : visibleCustomers.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyRefresh}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
          >
            <EmptyState
              icon={Users}
              title={summary.customerCount === 0 ? 'No customers yet. Add your first customer' : 'No customers found'}
              message={summary.customerCount === 0
                ? 'Customers you add will appear here.'
                : filter === 'owes'
                  ? 'No customers currently owe your business.'
                  : filter === 'settled'
                    ? 'No settled customers match this list.'
                    : `No results for “${search}”. Try another name or phone number.`}
            />
          </ScrollView>
        ) : (
          <FlatList
            data={visibleCustomers}
            keyExtractor={(item) => item.id}
            renderItem={renderCustomer}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      <FAB label="Add customer" onPress={() => setShowAddForm(true)} />

      <Modal visible={showAddForm} animationType="slide" transparent onRequestClose={() => { if (!saving) setShowAddForm(false); }}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.scrim} onPress={() => !saving && setShowAddForm(false)} accessibilityRole="button" accessibilityLabel="Close add customer form" />
          <View style={styles.formSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Add customer</Text>
                <Text style={styles.modalSubtitle}>Name is required. Other details are optional.</Text>
              </View>
              <IconButton icon={X} label="Close add customer form" disabled={saving} onPress={() => setShowAddForm(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              <FormField label="Full name *" value={name} onChangeText={setName} placeholder="Customer name" accessibilityLabel="Customer full name" />
              <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" accessibilityLabel="Customer phone number" />
              <FormField label="Address" value={address} onChangeText={setAddress} placeholder="Optional address" accessibilityLabel="Customer address" />
              <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" accessibilityLabel="Customer notes" multiline />
              {formError ? <Text style={styles.formError} accessibilityRole="alert">{formError}</Text> : null}
              <Button label="Save customer" onPress={() => void submitCustomer()} loading={saving} disabled={saving} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function FormField({
  label,
  accessibilityLabel,
  multiline = false,
  ...inputProps
}: ComponentProps<typeof TextInput> & { label: string; accessibilityLabel: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={accessibilityLabel}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.field, multiline && styles.multilineField]}
      />
    </View>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  summaryLine: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  summaryText: { color: colors.danger, ...typography.label, flexShrink: 1 },
  summarySettled: { color: colors.textSecondary },
  search: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, height: 50, color: colors.text, ...typography.body },
  chipScroll: { flexGrow: 0, marginVertical: Spacing.two },
  chips: { gap: Spacing.two, paddingRight: Spacing.four },
  list: { gap: Spacing.two, paddingBottom: 92 },
  rowSeparator: { height: Spacing.two },
  emptyRefresh: { flexGrow: 1, justifyContent: 'center', paddingBottom: 72 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  errorText: { color: colors.danger, textAlign: 'center', ...typography.body },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  retryText: { color: colors.primaryDark, ...typography.label },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.38)' },
  formSheet: {
    maxHeight: '90%',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.white,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  modalTitleGroup: { flex: 1 },
  modalTitle: { color: colors.text, ...typography.heading },
  modalSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  formContent: { paddingBottom: Spacing.two },
  fieldGroup: { marginBottom: Spacing.three },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: Spacing.two },
  field: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    ...typography.body,
  },
  multilineField: { minHeight: 92, paddingTop: Spacing.three },
  formError: { color: colors.danger, ...typography.caption, marginBottom: Spacing.three },
});
