import { Tabs } from 'expo-router';
import { Home, Menu, Package, ShoppingCart, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

function TabIcon({ icon: Icon, focused }: {
  icon: typeof Home;
  focused: boolean;
}) {
  const color = focused ? colors.primary : colors.textSecondary;
  return (
    <View style={styles.iconWrap} accessible={false}>
      <Icon size={24} color={color} strokeWidth={focused ? 2.8 : 2} />
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
        tabBarItemStyle: { minHeight: 58, paddingTop: 2 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 5,
          paddingBottom: insets.bottom,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ focused }) => <TabIcon icon={Home} focused={focused} /> }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales', tabBarAccessibilityLabel: 'Sales tab', tabBarIcon: ({ focused }) => <TabIcon icon={ShoppingCart} focused={focused} /> }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarAccessibilityLabel: 'Stock tab', tabBarIcon: ({ focused }) => <TabIcon icon={Package} focused={focused} /> }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', tabBarAccessibilityLabel: 'Customers tab', tabBarIcon: ({ focused }) => <TabIcon icon={Users} focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarAccessibilityLabel: 'More tab', tabBarIcon: ({ focused }) => <TabIcon icon={Menu} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { height: 31, alignItems: 'center', justifyContent: 'flex-start' },
  indicator: { width: 14, height: 3, marginTop: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.primary },
});
