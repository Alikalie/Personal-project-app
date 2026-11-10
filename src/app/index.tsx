import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { useAuth } from '../components/AuthProvider';
import { routeFor } from '../services/authService';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Splash() {
  const { loading, ctx } = useAuth();
  const [animDone, setAnimDone] = useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(14)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.parallel([
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
    ]).start();
    const t = setTimeout(() => setAnimDone(true), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (animDone && !loading) router.replace(routeFor(ctx) as never);
  }, [animDone, loading, ctx]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      <View style={[s.circle, { width: 320, height: 320, top: -130, right: -110, opacity: 0.9 }]} />
      <View style={[s.circle, { width: 220, height: 220, bottom: -90, left: -80, opacity: 0.7 }]} />

      <View style={s.center}>
        <Animated.Image
          source={require('../../assets/images/sml-logo.png')}
          style={[s.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
        <Animated.View style={{ opacity: nameOpacity, transform: [{ translateY: nameY }], alignItems: 'center' }}>
          <Text style={s.name}>
            SaloneBiz <Text style={s.nameAccent}>Manager</Text>
          </Text>
        </Animated.View>
        <Animated.Text style={[s.tagline, { opacity: tagOpacity }]}>
          Your Business, Under Control.
        </Animated.Text>
      </View>

      <Animated.View style={[s.footer, { opacity: footerOpacity }]}>
        <View style={s.track}>
          <Animated.View style={[s.bar, { width: barWidth }]} />
        </View>
        <Text style={s.small}>Built for Sierra Leone businesses</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: colors.primaryLight },
  center: { alignItems: 'center', paddingHorizontal: 32 },
  logo: { width: 290, height: 193 },
  name: { marginTop: 4, fontSize: 26, fontWeight: '800', color: colors.primaryDark, letterSpacing: -0.4 },
  nameAccent: { color: colors.primary },
  tagline: { marginTop: 8, fontSize: 14, color: colors.textSecondary, letterSpacing: 0.4 },
  footer: { position: 'absolute', bottom: 56, alignItems: 'center', width: '100%' },
  track: { width: 132, height: 4, borderRadius: 2, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  small: { marginTop: 14, fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
});