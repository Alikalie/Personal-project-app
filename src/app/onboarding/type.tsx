import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Boxes, Hammer, LucideIcon, Pill, Shirt, ShoppingBasket, Smartphone, Store, Utensils } from 'lucide-react-native';

import { Button, Screen, StepDots } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { onboarding } from '@/services/onboardingStore';

const types: { label: string; icon: LucideIcon }[] = [
  { label: 'Retail shop', icon: Store },
  { label: 'Boutique', icon: Shirt },
  { label: 'Supermarket', icon: ShoppingBasket },
  { label: 'Pharmacy', icon: Pill },
  { label: 'Electronics', icon: Smartphone },
  { label: 'Food & drinks', icon: Utensils },
  { label: 'Hardware', icon: Hammer },
  { label: 'Other', icon: Boxes },
];

export default function BusinessType() {
  const [selected, setSelected] = useState(onboarding.businessType);

  const next = () => {
    onboarding.businessType = selected;
    router.push('/onboarding/profile');
  };

  return (
    <Screen back title="What do you sell?" subtitle="Step 2 of 3. Choose the type closest to your business."
      footer={<Button label="Continue" onPress={next} disabled={!selected} />}
    >
      <StepDots step={2} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
        {types.map(({ label, icon: Icon }) => {
          const active = selected === label;
          return (
            <Pressable key={label} onPress={() => setSelected(label)} style={{
              width: '48%', minHeight: 112, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg,
              borderWidth: 1.5, borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primaryLight : colors.white,
            }} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
              <Icon size={28} color={active ? colors.primary : colors.textSecondary} />
              <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '700', color: active ? colors.primaryDark : colors.text }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
