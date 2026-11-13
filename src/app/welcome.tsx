import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { LegalLinks } from '@/components/LegalLinks';

export default function Welcome() {
  const { settings } = usePublicAppSettings();
  return (
    <Screen footer={
      <>
        <Button label="Create account" onPress={() => router.push('/signup')} />
        <Pressable onPress={() => router.push('/login')} style={styles.loginLink}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Log in</Text></Text>
        </Pressable>
        <LegalLinks centered />
      </>
    }>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/sml-logo-tight.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="MiShop logo"
        />
        <Text style={styles.brand}>{settings.appName}</Text>
        <Text style={styles.tagline}>{settings.tagline}</Text>
        <Text style={styles.title}>Sell, track stock, and manage customers.</Text>
        <Text style={styles.subtitle}>
          Keep your shop organised from one simple dashboard.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 20, alignItems: 'center' },
  logo: { width: '100%', maxWidth: 300, height: 168 },
  brand: { fontSize: 24, fontWeight: '800', color: colors.primaryDark, marginTop: 4 },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 16,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginText: { fontSize: 15, color: colors.textSecondary },
  loginBold: { color: colors.primary, fontWeight: '700' },
});
