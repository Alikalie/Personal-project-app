import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { ScreenHeader, Skeleton } from '@/components/ds';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE, parseSLEToMinorUnits } from '@/lib/money';
import { refreshDashboardViews } from '@/services/dashboardService';
import {
  createExpense,
  createExpenseCategory,
  listExpenseCategories,
  listExpenses,
  type Expense,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from '@/services/expenseService';

const paymentMethods: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'afrimoney', label: 'Afrimoney' },
  { value: 'other', label: 'Other' },
];

function todayFreetown(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Freetown',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
  }).format(date);
}

function methodLabel(value: ExpensePaymentMethod): string {
  return paymentMethods.find((item) => item.value === value)?.label ?? 'Other';
}

export default function ExpensesScreen() {
  const { ctx } = useAuth();
  const role = ctx?.business?.role?.toLowerCase();
  const canManageExpenses = role === 'owner' || role === 'manager';
  const businessId = ctx?.business?.id ?? ctx?.businessId ?? null;
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [expenseDate, setExpenseDate] = useState(todayFreetown);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const load = useCallback(async () => {
    if (!businessId || !canManageExpenses) {
      setLoading(false);
      setError(!businessId ? 'Business details are not available.' : 'Only owners and managers can manage expenses.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [categoryRows, expenseRows] = await Promise.all([
        listExpenseCategories(businessId),
        listExpenses(businessId),
      ]);
      setCategories(categoryRows);
      setExpenses(expenseRows);
      setCategoryId((current) => current && categoryRows.some((item) => item.id === current)
        ? current
        : categoryRows[0]?.id ?? '');
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [businessId, canManageExpenses]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const parsedAmount = useMemo(() => {
    if (!amount.trim()) return null;
    try {
      return parseSLEToMinorUnits(amount);
    } catch {
      return null;
    }
  }, [amount]);

  const disabledReason = !businessId
    ? 'Business details are not available.'
    : categories.length === 0
      ? 'Add an expense category first.'
      : !categoryId
        ? 'Choose an expense category.'
        : parsedAmount === null || parsedAmount <= 0
          ? 'Enter an amount greater than zero.'
          : !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)
            ? 'Enter the date as YYYY-MM-DD.'
            : '';

  const submit = async () => {
    if (!businessId || !ctx?.id || !parsedAmount || disabledReason || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createExpense({
        businessId,
        userId: ctx.id,
        amountMinor: parsedAmount,
        categoryId,
        description: description.trim() || null,
        paymentMethod,
        expenseDate,
      });
      setAmount('');
      setDescription('');
      setExpenseDate(todayFreetown());
      setNotice('Expense saved.');
      const refreshErrors: string[] = [];
      try {
        setExpenses(await listExpenses(businessId));
      } catch (refreshError) {
        refreshErrors.push(`Expense list could not refresh: ${friendlyErrorMessage(refreshError)}`);
      }
      try {
        await refreshDashboardViews(businessId);
      } catch (refreshError) {
        refreshErrors.push(`Dashboard could not refresh: ${friendlyErrorMessage(refreshError)}`);
      }
      if (refreshErrors.length) setNotice(`Expense saved. ${refreshErrors.join('. ')}`);
    } catch (saveError) {
      console.warn('Expense save failed:', saveError);
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!businessId || savingCategory) return;
    setSavingCategory(true);
    setCategoryError('');
    try {
      const category = await createExpenseCategory(businessId, newCategoryName);
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(category.id);
      setNewCategoryName('');
      setShowCategoryForm(false);
    } catch (categorySaveError) {
      console.warn('Expense category save failed:', categorySaveError);
      setCategoryError(friendlyErrorMessage(categorySaveError));
    } finally {
      setSavingCategory(false);
    }
  };

  if (!canManageExpenses) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.page}>
          <ScreenHeader title="Expenses" onBack={() => router.back()} />
          <Text style={styles.error}>Only owners and managers can manage expenses.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Expenses" subtitle="Record and review business expenses" onBack={() => router.back()} />

          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Add expense</Text>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                setError('');
              }}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!saving}
              style={styles.amountInput}
              accessibilityLabel="Expense amount"
            />
            {amount.trim() && parsedAmount === null ? <Text style={styles.error}>Enter a valid amount, for example 25.50.</Text> : null}

            <View style={styles.categoryHeading}>
              <Text style={styles.label}>Category</Text>
              <Pressable onPress={() => setShowCategoryForm(true)} style={styles.addCategoryButton} accessibilityRole="button">
                <Text style={styles.addCategoryText}>Add category</Text>
              </Pressable>
            </View>
            {categories.length ? (
              <View style={styles.chips}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    disabled={saving}
                    style={[styles.chip, category.id === categoryId && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category.id === categoryId }}
                  >
                    <Text style={[styles.chipText, category.id === categoryId && styles.chipTextSelected]}>{category.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : <Text style={styles.helper}>Create a category before recording an expense.</Text>}

            <Text style={styles.label}>Paid by</Text>
            <View style={styles.chips}>
              {paymentMethods.map((method) => (
                <Pressable
                  key={method.value}
                  onPress={() => setPaymentMethod(method.value)}
                  disabled={saving}
                  style={[styles.chip, paymentMethod === method.value && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: paymentMethod === method.value }}
                >
                  <Text style={[styles.chipText, paymentMethod === method.value && styles.chipTextSelected]}>{method.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Date</Text>
            <TextInput
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              editable={!saving}
              style={styles.textInput}
              accessibilityLabel="Expense date"
            />

            <Field
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="What was this expense for?"
              editable={!saving}
              multiline
              numberOfLines={3}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Button label="Save expense" onPress={() => void submit()} loading={saving} disabled={saving || Boolean(disabledReason)} />
            {!saving && disabledReason ? <Text style={styles.helper}>{disabledReason}</Text> : null}
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent expenses</Text>
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          {loading && expenses.length === 0 ? (
            <View style={styles.skeletons}>
              {[0, 1, 2].map((item) => <Skeleton key={item} height={72} radius={14} />)}
            </View>
          ) : error && expenses.length === 0 ? (
            <Pressable onPress={() => void load()} style={styles.retry} accessibilityRole="button">
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.addCategoryText}>Try again</Text>
            </Pressable>
          ) : expenses.length === 0 ? (
            <Text style={styles.helper}>No expenses recorded yet.</Text>
          ) : expenses.map((expense) => (
            <View key={expense.id} style={styles.expenseRow}>
              <View style={styles.expenseCopy}>
                <Text style={styles.expenseCategory}>{expense.category_name}</Text>
                <Text style={styles.expenseMeta}>
                  {dateLabel(expense.expense_date)} · {methodLabel(expense.payment_method)}
                </Text>
                {expense.description ? <Text style={styles.expenseMeta}>{expense.description}</Text> : null}
              </View>
              <Text style={styles.expenseAmount}>{formatSLE(expense.amount_minor)}</Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCategoryForm} transparent animationType="fade" onRequestClose={() => setShowCategoryForm(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modal}>
            <Text style={styles.sectionTitle}>New expense category</Text>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Category name"
              placeholderTextColor={colors.textSecondary}
              editable={!savingCategory}
              style={styles.textInput}
              accessibilityLabel="New expense category name"
            />
            {categoryError ? <Text style={styles.error}>{categoryError}</Text> : null}
            <Button label="Save category" onPress={() => void addCategory()} loading={savingCategory} disabled={savingCategory || !newCategoryName.trim()} />
            <Button label="Cancel" variant="outline" onPress={() => setShowCategoryForm(false)} disabled={savingCategory} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  page: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.three },
  form: { padding: Spacing.three, borderRadius: radius.lg, backgroundColor: colors.white, gap: Spacing.two },
  sectionTitle: { color: colors.text, ...typography.heading },
  label: { color: colors.text, ...typography.label, marginTop: Spacing.one },
  amountInput: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.three, color: colors.text, fontSize: 20, fontWeight: '700' },
  textInput: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.three, color: colors.text, backgroundColor: colors.white },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  addCategoryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two },
  addCategoryText: { color: colors.primaryDark, ...typography.label },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { color: colors.textSecondary, ...typography.caption },
  chipTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  helper: { color: colors.textSecondary, ...typography.caption },
  error: { color: colors.danger, ...typography.caption },
  notice: { color: colors.success, ...typography.caption },
  historyHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skeletons: { gap: Spacing.two },
  retry: { minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  expenseRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: colors.border },
  expenseCopy: { flex: 1, minWidth: 0, gap: 3 },
  expenseCategory: { color: colors.text, ...typography.label },
  expenseMeta: { color: colors.textSecondary, ...typography.caption },
  expenseAmount: { color: colors.text, ...typography.label },
  modalScrim: { flex: 1, justifyContent: 'center', padding: Spacing.five, backgroundColor: 'rgba(0,0,0,0.42)' },
  modal: { padding: Spacing.four, borderRadius: radius.lg, backgroundColor: colors.background, gap: Spacing.three },
});
