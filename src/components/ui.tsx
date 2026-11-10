import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';

import { colors, radius } from '@/constants/theme';

export function Screen({ children, back, brand, title, subtitle, footer }: {
  children: ReactNode;
  back?: boolean;
  brand?: boolean;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
          {back && (
            <Pressable onPress={() => router.back()} style={s.back} hitSlop={12}>
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
          )}
          {brand && (
            <Image
              source={require('../../assets/images/sml-logo-tight.png')}
              style={s.brandLogo}
              contentFit="contain"
              accessibilityLabel="SML business logo"
            />
          )}
          {title && <Text style={s.title}>{title}</Text>}
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          {children}
        </ScrollView>
        {footer && <View style={s.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        primary ? { backgroundColor: colors.primary } : { borderWidth: 1.5, borderColor: colors.primary },
        (pressed || disabled) && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.primary} />
      ) : (
        <Text style={[s.btnText, { color: primary ? colors.white : colors.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, icon: Icon, error, secure, ...rest }: TextInputProps & {
  label: string;
  icon?: LucideIcon;
  error?: string;
  secure?: boolean;
}) {
  const [hidden, setHidden] = useState(!!secure);
  const [focus, setFocus] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.input, focus && { borderColor: colors.primary }, !!error && { borderColor: colors.danger }]}>
        {Icon && <Icon size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />}
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor="#A5AFA8"
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={s.textInput}
        />
        {secure && (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10}>
            {hidden ? <Eye size={18} color={colors.textSecondary} /> : <EyeOff size={18} color={colors.textSecondary} />}
          </Pressable>
        )}
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            backgroundColor: i < step ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 32, flexGrow: 1 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandLogo: { width: '100%', maxWidth: 250, height: 110, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6, marginBottom: 24, lineHeight: 22 },
  footer: {
    padding: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  btn: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
  },
  textInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%' },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
});
