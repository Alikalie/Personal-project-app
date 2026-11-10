import { Text, TextInput, View, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors } from '@/constants/theme';

type FieldProps = {
  label: string;
  icon?: LucideIcon;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secure?: boolean;
  error?: string;
};

export default function Field({
  label,
  icon: Icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secure = false,
  error,
}: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        {Icon ? (
          <View style={styles.iconWrap}>
            <Icon size={18} color={colors.textSecondary} />
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secure}
          style={styles.input}
        />
      </View>
      {!!error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  inputRow: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: { borderColor: colors.danger },
  iconWrap: { marginRight: 10 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  error: { marginTop: 6, color: colors.danger, fontSize: 12 },
});
