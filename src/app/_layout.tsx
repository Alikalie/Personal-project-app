import { Stack } from 'expo-router';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/CartProvider';
import { PreferencesProvider } from '../components/PreferencesProvider';

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
