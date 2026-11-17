import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { useAuth } from '../components/AuthProvider';
import { routeFor } from '../services/authService';
import { usePublicAppSettings } from '../components/PublicAppSettingsProvider';

export default function Splash() {
  const { loading, error, ctx, refresh } = useAuth();
  const { settings } = usePublicAppSettings();
  const [animDone, setAnimDone] = useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(14)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(450),
        Animated.parallel([
          Animated.timing(nameOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(nameY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([Animated.delay(800), Animated.timing(tagOpacity, { toValue: 1, duration: 500, useNativeDriver: true })]),
      Animated.sequence([Animated.delay(900), Animated.timing(footerOpacity, { toValue: 1, duration: 500, useNativeDriver: true })]),
      Animated.timing(progress, { toValue: 1, duration: 2300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start();
    const t = setTimeout(() => setAnimDone(true), 1600);
    return () => {
      clearTimeout(t);
      animation.stop();
    };
  }, [footerOpacity, logoOpacity, logoScale, nameOpacity, nameY, progress, tagOpacity]);

  useEffect(() => {
    if (animDone && !loading && !error) router.replace(routeFor(ctx));
  }, [animDone, loading, error, ctx]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      <View style={[s.circle, { width: 160, height: 160, top: -40, right: -40, opacity: 0.9 }]} />
      <View style={[s.circle, { width: 120, height: 120, bottom: -50, left: -40, opacity: 0.7 }]} />

      <View style={s.center}>
        <View style={s.brandRow}>
          <Animated.Image
            source={require('../../assets/images/mishop-icon.png')}
            style={[s.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
            accessibilityLabel="MiShop logo"
          />
          <Animated.View style={[s.brandCopy, { opacity: nameOpacity, transform: [{ translateY: nameY }] }]}>
            <Text style={s.name}>
              {settings.appName === 'MiShop' ? (
                <>
                  <Text style={s.namePrefix}>Mi</Text>
                  Shop
                </>
              ) : settings.appName}
            </Text>
            <Animated.Text style={[s.tagline, { opacity: tagOpacity }]}>
              My shop. My records. My profit.
            </Animated.Text>
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[s.footer, { opacity: footerOpacity }]}>
        <View style={s.track}>
          <Animated.View style={[s.bar, { width: barWidth }]} />
        </View>
        <Text style={s.small}>Built for shops in Sierra Leone</Text>
      </Animated.View>

      {loading ? (
        <View style={s.sessionState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={s.sessionText}>Checking your session...</Text>
        </View>
      ) : error ? (
        <View style={s.sessionState}>
          <Text style={s.sessionError}>{error}</Text>
          <Pressable onPress={() => void refresh().catch(() => undefined)} accessibilityRole="button">
            <Text style={s.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: colors.primaryLight },
  center: { alignItems: 'center', paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 56, height: 56 },
  brandCopy: { marginLeft: 8, alignItems: 'flex-start' },
  name: { fontFamily: 'Inter_800ExtraBold', fontSize: 25, lineHeight: 29, fontWeight: '800', color: colors.primary, letterSpacing: -0.8 },
  namePrefix: { color: '#0D2747' },
  tagline: { marginTop: 1, fontSize: 7, lineHeight: 10, color: '#596779', letterSpacing: 0.05 },
  footer: { position: 'absolute', bottom: 38, alignItems: 'center', width: '100%' },
  track: { width: 82, height: 2, borderRadius: 1, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  bar: { height: 2, backgroundColor: colors.primary, borderRadius: 1 },
  small: { marginTop: 9, fontSize: 8, color: '#596779', letterSpacing: 0.1 },
  sessionState: { position: 'absolute', bottom: 92, alignItems: 'center', paddingHorizontal: 24 },
  sessionText: { marginTop: 6, color: colors.textSecondary, fontSize: 12 },
  sessionError: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  retry: { color: colors.primary, fontWeight: '700', marginTop: 6 },
});