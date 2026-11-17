import { Text } from 'react-native';

import { colors } from '@/constants/theme';

export function ContactInfoHint({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 12 }}>
      {children}
    </Text>
  );
}
