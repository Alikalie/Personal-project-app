import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supportedCurrencies, type SupportedCurrency } from '@/lib/currencies';
import { colors, radius, Spacing, typography } from '@/constants/theme';

export function CurrencyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selected = supportedCurrencies.find((currency) => currency.code === value);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCurrencies = useMemo(() => {
    if (!normalizedSearch) return supportedCurrencies;
    return supportedCurrencies.filter((currency) =>
      currency.code.toLocaleLowerCase().includes(normalizedSearch)
      || currency.name.toLocaleLowerCase().includes(normalizedSearch)
      || currency.countries.some((country) => country.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [normalizedSearch]);

  const close = () => {
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={disabled}
        style={styles.selector}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Currency: ${selected.name} (${selected.code})` : `Currency: ${value}`}
        accessibilityState={{ disabled }}
      >
        <View style={styles.selectorCopy}>
          <Text style={styles.selectorLabel}>Business currency</Text>
          <Text style={styles.selectorValue}>{selected ? `${selected.name} (${selected.code})` : value}</Text>
          <Text style={styles.selectorHint}>Search by currency or country</Text>
        </View>
        <ChevronDown size={20} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Choose currency</Text>
              <Text style={styles.subtitle}>Currencies used across more than 190 countries.</Text>
            </View>
            <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close currency picker">
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search currency, code, or country"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.search}
            accessibilityLabel="Search currency or country"
          />
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(currency) => currency.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            windowSize={7}
            ListEmptyComponent={<Text style={styles.empty}>No matching currency or country.</Text>}
            renderItem={({ item }) => (
              <CurrencyOption
                currency={item}
                selected={item.code === value}
                onPress={() => {
                  onChange(item.code);
                  close();
                }}
              />
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function CurrencyOption({
  currency,
  selected,
  onPress,
}: {
  currency: SupportedCurrency;
  selected: boolean;
  onPress: () => void;
}) {
  const visibleCountries = currency.countries.slice(0, 5);
  const countrySummary = `${visibleCountries.join(', ')}${currency.countries.length > visibleCountries.length
    ? `, and ${currency.countries.length - visibleCountries.length} more`
    : ''}`;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityLabel={`${currency.name} (${currency.code}), used in ${currency.countries.join(', ')}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{currency.name} ({currency.code})</Text>
        <Text style={styles.optionCountries}>Countries: {countrySummary}</Text>
      </View>
      {selected ? <Check size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selector: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selectorCopy: { flex: 1, gap: 2 },
  selectorLabel: { color: colors.textSecondary, ...typography.caption },
  selectorValue: { color: colors.text, ...typography.label },
  selectorHint: { color: colors.textSecondary, ...typography.caption },
  modal: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.text, ...typography.heading },
  subtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.white },
  search: {
    minHeight: 50,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    color: colors.text,
    ...typography.body,
  },
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.primaryLight },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: colors.text, ...typography.label },
  optionCountries: { color: colors.textSecondary, ...typography.caption },
  empty: { padding: Spacing.five, color: colors.textSecondary, ...typography.body, textAlign: 'center' },
});
