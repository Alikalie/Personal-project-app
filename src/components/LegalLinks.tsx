import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FileText, ShieldCheck } from 'lucide-react-native';

import { colors } from '@/constants/theme';

export function LegalLinks({ centered = false }: { centered?: boolean }) {
  return (
    <View style={[styles.panel, centered && styles.centered]}>
      <View style={styles.intro}>
        <View style={styles.shield}>
          <ShieldCheck size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>YOUR TRUST MATTERS</Text>
          <Text style={styles.description}>Clear policies. Your information stays yours.</Text>
        </View>
      </View>
      <View style={styles.links}>
        <Pressable
          onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'privacy' } })}
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          accessibilityRole="link"
          accessibilityLabel="Read the Privacy Policy"
        >
          <ShieldCheck size={18} color={colors.primaryDark} />
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'terms' } })}
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          accessibilityRole="link"
          accessibilityLabel="Read the Terms and Conditions"
        >
          <FileText size={18} color={colors.primaryDark} />
          <Text style={styles.link}>Terms & Conditions</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  centered: { alignSelf: 'stretch' },
  intro: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  shield: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  introCopy: { flex: 1 },
  eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  description: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  links: { flexDirection: 'row', gap: 8 },
  linkCard: {
    minHeight: 46,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  linkCardPressed: { backgroundColor: colors.primaryLight },
  link: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
