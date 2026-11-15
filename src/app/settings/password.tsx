import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Field } from '@/components/ui';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { friendlyErrorMessage } from '@/lib/errors';
import { passwordPolicyError } from '@/lib/passwordPolicy';
import { updatePassword } from '@/services/settingsService';

export default function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dirty = useMemo(
    () => currentPassword.length > 0 || password.length > 0 || confirm.length > 0,
    [confirm, currentPassword, password],
  );
  const disablePrevention = useUnsavedChanges(dirty);

  const save = async () => {
    if (!currentPassword) return setError('Enter your current password.');
    const passwordError = passwordPolicyError(password);
    if (passwordError) return setError(passwordError);
    if (password === currentPassword) return setError('Choose a new password different from your current password.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    setError('');
    try {
      await updatePassword(currentPassword, password);
      disablePrevention();
      Alert.alert('Password updated', 'Your password has been changed.', [{ text: 'Done', onPress: () => undefined }]);
      setCurrentPassword('');
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
      subtitle="Enter your current password, then choose and confirm a new password with at least 8 characters and a symbol."
      footer={<Button label="Update password" onPress={() => void save()} loading={loading} disabled={!currentPassword || !password || !confirm || loading} />}
    >
      <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secure autoCapitalize="none" textContentType="password" />
      <Field label="New password" value={password} onChangeText={setPassword} secure autoCapitalize="none" textContentType="newPassword" />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" textContentType="newPassword" />
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}
