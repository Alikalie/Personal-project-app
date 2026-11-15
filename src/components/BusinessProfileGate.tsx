import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useSegments } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { colors } from '@/constants/theme';
import { isPlatformAdmin } from '@/lib/permissions';

function isProfileComplete(business: NonNullable<ReturnType<typeof useAuth>['ctx']>['business']): boolean {
  return Boolean(
    business?.name?.trim()
    && business.businessType?.trim()
    && business.address?.trim()
    && business.district?.trim()
    && (business.phone?.replace(/\D/g, '').length ?? 0) >= 8,
  );
}

export function BusinessProfileGate({ children }: { children: ReactNode }) {
  const { ctx, loading } = useAuth();
  const segments = useSegments();
  const onBusinessProfile = segments[0] === 'settings' && segments[1] === 'business';
  const requiresProfile = Boolean(
    ctx?.businessId
    && !isPlatformAdmin(ctx.platformAdminLevel)
    && !isProfileComplete(ctx.business),
  );

  useEffect(() => {
    if (!loading && requiresProfile && !onBusinessProfile) {
      router.replace({ pathname: '/settings/business', params: { required: 'true' } });
    }
  }, [loading, onBusinessProfile, requiresProfile]);

  if (requiresProfile && !onBusinessProfile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
