import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Field } from '@/components/ui';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { friendlyErrorMessage } from '@/lib/errors';
import { updatePassword } from '@/services/settingsService';

export default function PasswordSettings() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dirty = useMemo(() => password.length > 0 || confirm.length > 0, [password, confirm]);
  const disablePrevention = useUnsavedChanges(dirty);

  const save = async () => {
    if (password.length < 6) return setError('Choose a password with at least 6 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      disablePrevention();
      Alert.alert('Password updated', 'Your password has been changed.', [{ text: 'Done', onPress: () => undefined }]);
      setPassword('');
      setConfirm('');
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPage
      title="Change password"
      subtitle="Use at least 6 characters for your new password."
      footer={<Button label="Update password" onPress={() => void save()} loading={loading} disabled={!password || !confirm || loading} />}
    >
      <Field label="New password" value={password} onChangeText={setPassword} secure autoCapitalize="none" textContentType="newPassword" />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" textContentType="newPassword" />
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
