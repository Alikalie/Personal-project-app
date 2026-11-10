import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';

import { colors } from '@/constants/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

export default function Screen({ title, subtitle, back = false, footer, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {(title || back) && (
          <View style={styles.header}>
            {back ? (
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={20} color={colors.text} />
              </Pressable>
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
          </View>
        )}

        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 18, lineHeight: 22 },
  content: { paddingBottom: 18 },
  footer: { paddingBottom: 18, paddingTop: 8 },
});
