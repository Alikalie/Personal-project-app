import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { colors } from '@/constants/theme';

type FieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'> & {
  label: string;
  icon?: LucideIcon;
  value: string;
  onChangeText: (text: string) => void;
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
  ...inputProps
}: FieldProps) {
  const [visible, setVisible] = useState(false);
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
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secure && !visible}
          accessibilityLabel={label}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            onPress={() => setVisible((current) => !current)}
            style={styles.visibilityButton}
            accessibilityRole="button"
            accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {visible ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
          </Pressable>
        ) : null}
      </View>
      {!!error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  inputRow: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 52,
    paddingVertical: 8,
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
  visibilityButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  error: { marginTop: 6, color: colors.danger, fontSize: 12 },
});
