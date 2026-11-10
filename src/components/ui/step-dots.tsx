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
          style={[styles.dot, index + 1 === step ? styles.activeDot : styles.inactiveDot]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 },
  dot: { width: 34, height: 6, borderRadius: 999 },
  activeDot: { backgroundColor: colors.primary },
  inactiveDot: { backgroundColor: colors.border },
});
