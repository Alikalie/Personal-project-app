import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/CartProvider';
import { PreferencesProvider } from '../components/PreferencesProvider';
import { PublicAppSettingsProvider } from '../components/PublicAppSettingsProvider';
import { LegalAcceptanceGate } from '../components/LegalAcceptanceGate';
import { AppReleaseGate } from '../components/AppReleaseGate';
import { SecurityGuard } from '../components/SecurityGuard';
import { BusinessProfileGate } from '../components/BusinessProfileGate';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <PublicAppSettingsProvider>
      <PreferencesProvider>
        <AuthProvider>
          <BusinessProfileGate>
            <SecurityGuard>
              <CartProvider>
                <AppReleaseGate>
                  <LegalAcceptanceGate>
                    <Stack screenOptions={{ headerShown: false }} />
                  </LegalAcceptanceGate>
                </AppReleaseGate>
              </CartProvider>
            </SecurityGuard>
          </BusinessProfileGate>
        </AuthProvider>
      </PreferencesProvider>
    </PublicAppSettingsProvider>
  );
}
