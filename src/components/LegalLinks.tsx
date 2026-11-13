import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors } from '@/constants/theme';

export function LegalLinks({ centered = false }: { centered?: boolean }) {
  return (
    <View style={[styles.row, centered && styles.centered]}>
      <Pressable onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'privacy' } })} style={styles.linkTarget} accessibilityRole="link">
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      <Text style={styles.separator}> · </Text>
      <Pressable onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'terms' } })} style={styles.linkTarget} accessibilityRole="link">
        <Text style={styles.link}>Terms and Conditions</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 16 },
  centered: { justifyContent: 'center' },
  linkTarget: { minHeight: 40, justifyContent: 'center' },
  link: { color: colors.primaryDark, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  separator: { color: colors.textSecondary, fontSize: 13 },
});
