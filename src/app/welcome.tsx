import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function Welcome() {
  return (
    <Screen footer={
      <>
        <Button label="Create account" onPress={() => router.push('/signup')} />
        <Pressable onPress={() => router.push('/login')} style={styles.loginLink}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Log in</Text></Text>
        </Pressable>
      </>
    }>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/sml-logo-tight.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="SML business logo"
        />
        <Text style={styles.title}>Manage sales, stock and customer credit in one place.</Text>
        <Text style={styles.subtitle}>
          Track daily business performance and keep your shop organised from one easy dashboard.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 28, alignItems: 'center' },
  logo: { width: '100%', maxWidth: 340, height: 188 },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.8,
    marginTop: 20,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginText: { fontSize: 15, color: colors.textSecondary },
  loginBold: { color: colors.primary, fontWeight: '700' },
});
