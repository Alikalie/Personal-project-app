import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useAuth } from '@/components/AuthProvider';
import { AdminScreen } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui';
import { colors, Spacing, typography } from '@/constants/theme';
import { exportConsentedMarketingEmails } from '@/services/marketingEmailExportService';

export default function AdminEmailExportScreen() {
  const { ctx } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const allowed = ctx?.platformAdminLevel === 'super_admin';

  const exportEmails = async () => {
    if (!allowed || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    let fileUri: string | null = null;
    try {
      if (Platform.OS === 'web') throw new Error('Email export is available in the Android and iOS apps.');
      const { csv, count } = await exportConsentedMarketingEmails();
      if (!FileSystem.cacheDirectory) throw new Error('Device storage is unavailable.');
      fileUri = `${FileSystem.cacheDirectory}mishop-consented-emails-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (!await Sharing.isAvailableAsync()) throw new Error('No compatible sharing app is available on this device.');
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share consented MiShop email addresses',
        UTI: 'public.comma-separated-values-text',
      });
      setMessage(`CSV ready with ${count} opted-in email ${count === 1 ? 'address' : 'addresses'}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not prepare the email export.');
    } finally {
      if (fileUri) {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch {
          setError('The export file could not be removed from temporary storage. Remove it from the MiShop cache before sharing this device.');
        }
      }
      setLoading(false);
    }
  };

  return (
    <AdminScreen title="Email export" subtitle="Export only users who opted in to marketing emails.">
      {!allowed ? <Text style={{ color: colors.danger, ...typography.caption }}>Only super admins can export email addresses.</Text> : (
        <View style={{ gap: Spacing.three }}>
          <Text style={{ color: colors.textSecondary, ...typography.body }}>
            The CSV contains email addresses only. It is generated on demand and is not stored by MiShop after the share sheet closes.
          </Text>
          {error ? <Text style={{ color: colors.danger, ...typography.caption }}>{error}</Text> : null}
          {message ? <Text style={{ color: colors.success, ...typography.caption }}>{message}</Text> : null}
          <Button label="Export opted-in email addresses" onPress={() => void exportEmails()} loading={loading} disabled={loading} />
        </View>
      )}
    </AdminScreen>
  );
}
