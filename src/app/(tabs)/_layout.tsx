import { Tabs } from 'expo-router';
import { Home, Menu, Package, ShoppingCart, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.6 : 2} /> }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales', tabBarIcon: ({ color, focused }) => <ShoppingCart size={22} color={color} strokeWidth={focused ? 2.6 : 2} /> }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: ({ color, focused }) => <Package size={22} color={color} strokeWidth={focused ? 2.6 : 2} /> }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', tabBarIcon: ({ color, focused }) => <Users size={22} color={color} strokeWidth={focused ? 2.6 : 2} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <Menu size={22} color={color} strokeWidth={focused ? 2.6 : 2} /> }} />
    </Tabs>
  );
}
