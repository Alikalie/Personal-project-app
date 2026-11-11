import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
};

export default function Button({ label, onPress, loading = false, disabled = false, variant = 'primary' }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' && styles.outline,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    minHeight: 54,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineText: { color: colors.primaryDark },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.95 },
});
