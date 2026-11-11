import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Card } from '@/components/ds';
import { InfoMessage, SettingsPage, useUnsavedChanges } from '@/components/settings/SettingsPage';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { canEditBusiness } from '@/lib/permissions';
import { friendlyErrorMessage } from '@/lib/errors';
import { getLogoUrl, removeBusinessLogo, updateBusiness, uploadBusinessLogo } from '@/services/settingsService';

const businessTypes = ['Retail shop', 'Boutique', 'Supermarket', 'Pharmacy', 'Electronics', 'Food & drinks', 'Hardware', 'Other'];

export default function BusinessSettings() {
  const { ctx, refresh } = useAuth();
  const business = ctx?.business;
  const editable = canEditBusiness(business?.role);
  const [name, setName] = useState(business?.name ?? '');
  const [type, setType] = useState(business?.businessType ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  const [district, setDistrict] = useState(business?.district ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState('');
  const original = useMemo(() => ({
    name: business?.name ?? '',
    type: business?.businessType ?? '',
    address: business?.address ?? '',
    district: business?.district ?? '',
    phone: business?.phone ?? '',
  }), [business]);
  const dirty = name !== original.name || type !== original.type || address !== original.address || district !== original.district || phone !== original.phone;
  const disablePrevention = useUnsavedChanges(dirty);

  useEffect(() => {
    let active = true;
    void getLogoUrl(business?.logoPath ?? null).then((url) => {
      if (active) setLogoUrl(url);
    }).catch((loadError: unknown) => {
      if (active) setError(friendlyErrorMessage(loadError));
    });
    return () => { active = false; };
  }, [business?.logoPath]);

  const save = async () => {
    if (!ctx?.businessId) return setError('Business details are not available.');
    if (name.trim().length < 2) return setError('Business name must be at least 2 characters.');
    if (phone.trim() && phone.replace(/\D/g, '').length < 8) return setError('Enter a phone number with at least 8 digits.');
    setSaving(true);
    setError('');
    try {
      await updateBusiness(ctx.businessId, {
        name: name.trim(),
        business_type: type,
        address: address.trim(),
        district: district.trim(),
        phone: phone.trim(),
      });
      await refresh();
      disablePrevention();
      Alert.alert('Business updated', 'Your business profile has been saved.');
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async (camera: boolean) => {
    if (!ctx?.businessId) return setError('Business details are not available.');
    setError('');
    setLogoBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Allow camera access to take a business logo photo.');
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Allow photo access to choose a business logo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const path = await uploadBusinessLogo(ctx.businessId, asset);
      await refresh();
      setLogoUrl(await getLogoUrl(path));
      Alert.alert('Logo updated', 'Your business logo has been saved.');
    } catch (pickError) {
      setError(friendlyErrorMessage(pickError));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = () => {
    if (!ctx?.businessId) return;
    Alert.alert('Remove business logo?', 'The logo will no longer appear in your business profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setLogoBusy(true);
          void removeBusinessLogo(ctx.businessId!, business?.logoPath ?? null).then(async () => {
            setLogoUrl(null);
            await refresh();
          }).catch((removeError: unknown) => setError(friendlyErrorMessage(removeError)))
            .finally(() => setLogoBusy(false));
        },
      },
    ]);
  };

  return (
    <SettingsPage
      title="Business profile"
      subtitle="Business details and logo."
      footer={editable ? <Button label="Save changes" onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
    >
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.text, ...typography.heading }}>{business?.name ?? 'Business'}</Text>
        <Text style={{ color: colors.textSecondary }}>ID: {ctx?.businessCode ?? 'Not available'}</Text>
        <Text style={{ color: colors.textSecondary }}>Type: {business?.businessType ?? 'Not set'}</Text>
        <Text style={{ color: colors.textSecondary }}>Created: {business?.createdAt ? new Date(business.createdAt).toLocaleDateString() : 'Not available'}</Text>
      </Card>
      {!editable ? <InfoMessage>Only owners and managers can edit business details.</InfoMessage> : null}
      <Field label="Business name" value={name} onChangeText={setName} editable={editable} />
      <Text style={{ color: colors.text, ...typography.label }}>Business type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {businessTypes.map((option) => (
          <Pressable key={option} disabled={!editable} onPress={() => setType(option)} accessibilityRole="button" accessibilityState={{ selected: type === option, disabled: !editable }} style={{
            borderRadius: radius.xl, borderWidth: 1, borderColor: type === option ? colors.primary : colors.border,
            backgroundColor: type === option ? colors.primaryLight : colors.white, minHeight: 48, paddingHorizontal: 12, justifyContent: 'center',
          }}>
            <Text style={{ color: type === option ? colors.primaryDark : colors.textSecondary, ...typography.caption }}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Address" value={address} onChangeText={setAddress} editable={editable} />
      <Field label="District" value={district} onChangeText={setDistrict} editable={editable} />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={editable} />
      <Card style={{ gap: Spacing.three, alignItems: 'center' }}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 120, height: 120, borderRadius: radius.md }} contentFit="contain" accessibilityLabel="Business logo preview" /> : <Text style={{ color: colors.textSecondary }}>No business logo uploaded</Text>}
        {editable ? (
          <>
            <View style={{ width: '100%' }}><Button label="Choose from gallery" variant="outline" onPress={() => void pickLogo(false)} loading={logoBusy} /></View>
            <View style={{ width: '100%' }}><Button label="Take a photo" variant="outline" onPress={() => void pickLogo(true)} loading={logoBusy} /></View>
            {business?.logoPath ? <Button label="Remove logo" variant="outline" onPress={removeLogo} disabled={logoBusy} /> : null}
          </>
        ) : null}
      </Card>
      {error ? <InfoMessage tone="danger">{error}</InfoMessage> : null}
      {business?.role ? <Badge label={business.role} tone="neutral" /> : null}
    </SettingsPage>
  );
}
