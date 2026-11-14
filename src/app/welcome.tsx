import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { LegalLinks } from '@/components/LegalLinks';

export default function Welcome() {
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
          source={require('../../assets/images/mishop-icon.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="MiShop logo"
        />
        <Text style={styles.title}>Sell, track stock, and manage customers.</Text>
        <Text style={styles.subtitle}>
          Keep your shop organised from one simple dashboard.
        </Text>
        <Image
          source={require('../../assets/images/mishop-welcome-owner.png')}
          style={styles.illustration}
          contentFit="contain"
          accessibilityLabel="Shop owner managing stock with MiShop"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 20, alignItems: 'center' },
  logo: { width: 144, height: 144, marginBottom: 8 },
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
  illustration: { width: '100%', maxWidth: 320, aspectRatio: 1, marginTop: 12 },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginText: { fontSize: 15, color: colors.textSecondary },
  loginBold: { color: colors.primary, fontWeight: '700' },
});
