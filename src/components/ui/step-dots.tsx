import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

type StepDotsProps = {
  step: number;
  total?: number;
};

export default function StepDots({ step, total = 3 }: StepDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index < step ? styles.activeDot : styles.inactiveDot]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  dot: { flex: 1, height: 4, borderRadius: 999 },
  activeDot: { backgroundColor: colors.primary },
  inactiveDot: { backgroundColor: colors.border },
});
