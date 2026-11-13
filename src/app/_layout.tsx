import { Stack } from 'expo-router';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/CartProvider';
import { PreferencesProvider } from '../components/PreferencesProvider';
import { PublicAppSettingsProvider } from '../components/PublicAppSettingsProvider';

export default function RootLayout() {
  return (
    <PublicAppSettingsProvider>
      <PreferencesProvider>
        <AuthProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </CartProvider>
        </AuthProvider>
      </PreferencesProvider>
    </PublicAppSettingsProvider>
  );
}
