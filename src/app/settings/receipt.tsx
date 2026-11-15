import { useEffect, useMemo, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/ds';
import { ReceiptHtmlPreview } from '@/components/receipts/ReceiptHtmlPreview';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { receiptDateText } from '@/lib/receipt/buildReceiptData';
import type { ReceiptData } from '@/lib/receipt/types';
import { getLogoDataUri, updateBusiness } from '@/services/settingsService';

export default function ReceiptSettings() {
  const { ctx, refresh } = useAuth();
  const business = ctx?.business;
  const editable = canEditBusiness(business?.role);
  const [header, setHeader] = useState(business?.receiptHeader ?? '');
  const [footer, setFooter] = useState(business?.receiptFooter ?? '');
  const [showLogo, setShowLogo] = useState(business?.showLogoOnReceipt ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLogoDataUri(null);
    setPreviewError('');
    if (!showLogo || !business?.logoPath) return () => { active = false; };
    void getLogoDataUri(business.logoPath).then((dataUri) => {
      if (active) setLogoDataUri(dataUri);
    }).catch((logoError: unknown) => {
      if (active) setPreviewError(friendlyErrorMessage(logoError));
    });
    return () => { active = false; };
  }, [business?.logoPath, showLogo]);

  const sampleReceipt = useMemo<ReceiptData>(() => ({
    type: 'sale',
    receiptNo: 'R-00012',
    dateText: receiptDateText(new Date().toISOString()),
    business: {
      name: business?.name ?? 'Your business',
      address: business?.address,
      phone: business?.phone,
      header: header || 'Quality goods, fair prices',
      footer: footer || 'Thank you for shopping with us!',
      currencyCode: business?.currencyCode ?? 'SLE',
      logoDataUri: showLogo ? logoDataUri : null,
    },
    cashierName: 'Aminata',
    customer: { name: 'Fatmata Kamara', phone: '+232 77 555 010' },
    items: [
      { name: 'Rice 50kg', qty: 1, unitMinor: 45000, totalMinor: 45000 },
      { name: 'Sugar 1kg', qty: 3, unitMinor: 3000, totalMinor: 9000 },
      { name: 'Soap bar', qty: 2, unitMinor: 800, totalMinor: 1600 },
    ],
    subtotalMinor: 55600,
    discountMinor: 600,
    totalMinor: 55000,
    payments: [
      { method: 'cash', amountMinor: 30000 },
      { method: 'orange_money', amountMinor: 15000, reference: 'OM12345' },
    ],
    changeGivenMinor: 0,
    creditMinor: 10000,
    customerBalanceAfterMinor: 25000,
  }), [
    business?.address,
    business?.currencyCode,
    business?.name,
    business?.phone,
    footer,
    header,
    logoDataUri,
    showLogo,
  ]);
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
        <ReceiptHtmlPreview data={sampleReceipt} />
        <Text style={styles.sample}>All amounts shown are sample values.</Text>
      </Card>
      {previewError ? <InfoMessage tone="danger">{previewError}</InfoMessage> : null}
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
  receiptText: { color: colors.textSecondary, ...typography.caption, textAlign: 'center' as const },
  toggleRow: { minHeight: 64, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.white },
  toggleTitle: { color: colors.text, ...typography.label },
};
