import { useState } from 'react';
import { router } from 'expo-router';
import { Store, User } from 'lucide-react-native';

import { Button, Field, Screen, StepDots } from '@/components/ui';
import { onboarding } from '@/services/onboardingStore';

export default function BusinessRegistration() {
  const [name, setName] = useState(onboarding.businessName);
  const [owner, setOwner] = useState(onboarding.ownerName);
  const [error, setError] = useState('');

  const next = () => {
    if (name.trim().length < 2) {
      setError('Enter your business name.');
      return;
    }
    onboarding.businessName = name.trim();
    onboarding.ownerName = owner.trim();
    router.push('/onboarding/type');
  };

  return (
    <Screen back title="Register your business" subtitle="Step 1 of 3. Tell us who you are."
      footer={<Button label="Continue" onPress={next} />}
    >
      <StepDots step={1} />
      <Field label="Business name" icon={Store} value={name} onChangeText={setName} placeholder="e.g. Aminata Fashion Store" error={error} />
      <Field label="Owner name" icon={User} value={owner} onChangeText={setOwner} placeholder="Your full name" />
    </Screen>
  );
}
