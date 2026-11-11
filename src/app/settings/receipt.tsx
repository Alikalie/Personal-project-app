import { useMemo, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/ds';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { formatSLE } from '@/lib/money';
import { updateBusiness } from '@/services/settingsService';

export default function ReceiptSettings() {
  const { ctx, refresh } = useAuth();
  const business = ctx?.business;
  const editable = canEditBusiness(business?.role);
  const [header, setHeader] = useState(business?.receiptHeader ?? '');
  const [footer, setFooter] = useState(business?.receiptFooter ?? '');
  const [showLogo, setShowLogo] = useState(business?.showLogoOnReceipt ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = header !== (business?.receiptHeader ?? '') || footer !== (business?.receiptFooter ?? '') || showLogo !== (business?.showLogoOnReceipt ?? false);
  const disablePrevention = useUnsavedChanges(dirty);

  const save = async () => {
    if (!ctx?.businessId) return setError('Business details are not available.');
    setSaving(true);
    setError('');
    try {
      await updateBusiness(ctx.businessId, {
        receipt_header: header.trim(),
        receipt_footer: footer.trim(),
        show_logo_on_receipt: showLogo,
      });
      await refresh();
      disablePrevention();
      Alert.alert('Receipt settings saved', 'Your receipt settings have been updated.');
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPage
      title="Receipt settings"
      subtitle="Preview changes before saving."
      footer={editable ? <Button label="Save receipt settings" onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
    >
      {!editable ? <InfoMessage>Only owners and managers can edit receipt settings.</InfoMessage> : null}
      <Card style={styles.receipt}>
        <Text style={styles.sample}>SAMPLE RECEIPT</Text>
        {showLogo && business?.logoPath ? <Text style={styles.logoHint}>Business logo enabled</Text> : null}
        <Text style={styles.businessName}>{business?.name ?? 'Your business'}</Text>
        {business?.address ? <Text style={styles.receiptText}>{business.address}</Text> : null}
        {business?.phone ? <Text style={styles.receiptText}>{business.phone}</Text> : null}
        <Text style={styles.receiptText}>{header || 'Receipt header appears here'}</Text>
        <View style={styles.separator} />
        <View style={styles.itemRow}><Text style={styles.receiptText}>Sample item  ×  2</Text><Text style={styles.receiptText}>{formatSLE(25000)}</Text></View>
        <View style={styles.itemRow}><Text style={styles.receiptText}>Sample item  ×  1</Text><Text style={styles.receiptText}>{formatSLE(10000)}</Text></View>
        <View style={styles.separator} />
        <View style={styles.itemRow}><Text style={styles.receiptText}>Subtotal</Text><Text style={styles.receiptText}>{formatSLE(35000)}</Text></View>
        <View style={styles.itemRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalLabel}>{formatSLE(35000)}</Text></View>
        <Text style={styles.receiptText}>{footer || 'Receipt footer appears here'}</Text>
        <Text style={styles.sample}>All amounts shown are sample values.</Text>
      </Card>
      <Field label="Receipt header" value={header} onChangeText={setHeader} editable={editable} placeholder="Optional greeting" multiline numberOfLines={3} />
      <Field label="Receipt footer" value={footer} onChangeText={setFooter} editable={editable} placeholder="Thank you for your business" multiline numberOfLines={3} />
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Show logo on receipt</Text>
          <Text style={styles.receiptText}>Use the business logo when available.</Text>
        </View>
        <Switch value={showLogo} onValueChange={setShowLogo} disabled={!editable} trackColor={{ true: colors.primary }} accessibilityLabel="Show logo on receipt" />
      </View>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
    </SettingsPage>
  );
}

const styles = {
  receipt: { padding: Spacing.four, gap: Spacing.two, borderStyle: 'dashed' as const, borderWidth: 1, borderColor: colors.border },
  sample: { color: colors.textSecondary, ...typography.caption, textAlign: 'center' as const },
  logoHint: { color: colors.primaryDark, ...typography.caption, textAlign: 'center' as const },
  businessName: { color: colors.text, ...typography.heading, textAlign: 'center' as const },
  receiptText: { color: colors.textSecondary, ...typography.caption, textAlign: 'center' as const },
  separator: { borderBottomWidth: 1, borderStyle: 'dashed' as const, borderColor: colors.border, marginVertical: 5 },
  itemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 8 },
  totalLabel: { color: colors.text, ...typography.label },
  toggleRow: { minHeight: 64, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.white },
  toggleTitle: { color: colors.text, ...typography.label },
};
