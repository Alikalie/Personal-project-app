import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors } from '@/constants/theme';

type Props = {
  title: string;
  icon: LucideIcon;
  text: string;
};

export default function ComingSoon({ title, icon: Icon, text }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 18, fontSize: 22, fontWeight: '800', color: colors.text },
  text: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
});
