import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, Spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { getAppReleaseStatus, type AppReleaseStatus } from '@/services/appReleaseService';
import { safeHttpsUrl } from '@/lib/urls';

const deferKey = '@mishop/update-deferred-until';
const deferDuration = 24 * 60 * 60 * 1000;

async function updateWasDeferred(): Promise<boolean> {
  const value = await AsyncStorage.getItem(deferKey);
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    if (value) await AsyncStorage.removeItem(deferKey);
    return false;
  }
  return true;
}

export function AppReleaseGate({ children }: { children: ReactNode }) {
  const { settings } = usePublicAppSettings();
  const [status, setStatus] = useState<AppReleaseStatus | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState('');
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const check = useCallback(async () => {
    try {
      const [release, hasDeferred] = await Promise.all([
        getAppReleaseStatus(platform, version),
        updateWasDeferred(),
      ]);
      setStatus(release);
      setDeferred(hasDeferred);
    } catch (error) {
      console.warn('Release status setup failed:', error);
      setStatus(null);
    }
  }, [platform, version]);

  useEffect(() => {
    void check();
  }, [check]);

  const openUpdate = async () => {
    if (!status?.updateUrl || opening) return;
    const updateUrl = safeHttpsUrl(status.updateUrl);
    if (!updateUrl) {
      setLinkError('The update link is invalid. Contact support for help.');
      return;
    }
    setOpening(true);
    setLinkError('');
    try {
      await Linking.openURL(updateUrl);
    } catch {
      setLinkError('The update link could not be opened. Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  };

  const deferUpdate = async () => {
    await AsyncStorage.setItem(deferKey, String(Date.now() + deferDuration));
    setDeferred(true);
  };

  if (status?.updateRequired) {
    return (
      <View style={styles.required}>
        <Text style={styles.title}>Please update {settings.appName}</Text>
        <Text style={styles.body}>Version {status.latestVersion} is required to continue.</Text>
        {status.releaseNotes ? <Text style={styles.notes}>{status.releaseNotes}</Text> : null}
        {linkError ? <Text style={styles.body}>{linkError}</Text> : null}
        {status.updateUrl ? (
          <Button label="Update MiShop" onPress={() => void openUpdate()} loading={opening} />
        ) : (
          <Text style={styles.body}>Contact support: {settings.supportEmail}</Text>
        )}
      </View>
    );
  }

  return (
    <>
      {children}
      <Modal
        visible={Boolean(status?.updateAvailable && !deferred)}
        transparent
        animationType="slide"
        onRequestClose={() => void deferUpdate()}
      >
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.title}>A new version is available</Text>
              <Text style={styles.body}>MiShop {status?.latestVersion} is ready to install.</Text>
              {status?.releaseNotes ? <Text style={styles.notes}>{status.releaseNotes}</Text> : null}
              {linkError ? <Text style={styles.body}>{linkError}</Text> : null}
              {status?.updateUrl ? <Button label="Update" onPress={() => void openUpdate()} loading={opening} /> : null}
              <Pressable onPress={() => void deferUpdate()} style={styles.later} accessibilityRole="button">
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  required: { flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.three, backgroundColor: colors.background },
  title: { color: colors.text, ...typography.title },
  body: { color: colors.textSecondary, ...typography.body },
  notes: { color: colors.text, ...typography.body, lineHeight: 23 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: { maxHeight: '75%', padding: Spacing.five, paddingBottom: Spacing.seven, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  sheetContent: { gap: Spacing.three },
  later: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  laterText: { color: colors.textSecondary, ...typography.label },
});
