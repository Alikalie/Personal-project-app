import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { isPlatformAdmin } from '@/lib/permissions';

export default function AdminLayout() {
  const { ctx, loading } = useAuth();
  const allowed = isPlatformAdmin(ctx?.platformAdminLevel);

  useEffect(() => {
    if (!loading && !allowed) router.replace('/(tabs)');
  }, [allowed, loading]);

  if (loading || !allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
