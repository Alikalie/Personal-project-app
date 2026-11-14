import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Mail, MessageCircle, Phone } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { Button } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Card, ListRow } from '@/components/ds';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { listPublishedFAQ, type FAQItem } from '@/services/contentService';
import { colors, minTouchTarget, Spacing, typography } from '@/constants/theme';
import { safeContactUrl } from '@/lib/urls';

export default function HelpSettings() {
  const { ctx } = useAuth();
  const { settings } = usePublicAppSettings();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [faq, setFaq] = useState<FAQItem[]>([]);
  const [faqOffline, setFaqOffline] = useState(false);
  const [faqError, setFaqError] = useState('');
  const [faqLoading, setFaqLoading] = useState(true);
  const appVersion = Constants.expoConfig?.version ?? 'Unknown';

  const loadFAQ = useCallback(async () => {
    setFaqLoading(true);
    setFaqError('');
    try {
      const result = await listPublishedFAQ();
      setFaq(result.items);
      setFaqOffline(result.offline);
    } catch (error) {
      console.warn('FAQ could not be loaded:', error);
      setFaqError('Could not load frequently asked questions.');
    } finally {
      setFaqLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadFAQ();
  }, [loadFAQ]));

  const openContact = async (url: string, title: string) => {
    const safeUrl = safeContactUrl(url);
    if (!safeUrl) {
      Alert.alert('Invalid contact link', 'Check the support contact details and try again.');
      return;
    }
    try {
      await Linking.openURL(safeUrl);
    } catch {
      console.warn(`Unable to open ${title} contact link`);
      Alert.alert('Unable to open contact', `Please check that a ${title.toLowerCase()} app is available on this device.`);
    }
  };

  const reportProblem = () => {
    const device = [Device.manufacturer, Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' ');
    const body = [
      'Please describe the problem below:',
      '',
      `App version: ${appVersion}`,
      `Device: ${device || 'Unknown'}`,
      `User ID: ${ctx?.id ?? 'Unknown'}`,
    ].join('\n');
    void openContact(`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`${settings.appName} problem report`)}&body=${encodeURIComponent(body)}`, 'Email');
  };

  const phone = settings.supportPhone.replace(/[^\d+]/g, '');
  const whatsapp = settings.supportWhatsapp.replace(/\D/g, '');

  return (
    <SettingsPage title="Help and support" subtitle="Get in touch or find a quick answer.">
      <Card style={styles.contacts}>
        <ListRow icon={MessageCircle} title="WhatsApp" subtitle="Chat with support" chevron onPress={() => void openContact(`https://wa.me/${whatsapp}`, 'WhatsApp')} />
        <ListRow icon={Phone} title="Call support" subtitle={settings.supportPhone} chevron onPress={() => void openContact(`tel:${phone}`, 'phone')} />
        <ListRow icon={Mail} title="Email support" subtitle={settings.supportEmail} chevron onPress={() => void openContact(`mailto:${settings.supportEmail}`, 'Email')} />
      </Card>

      <Text style={styles.sectionTitle}>Frequently asked questions</Text>
      {faqOffline ? <Text style={styles.answer}>Showing saved answers while offline.</Text> : null}
      {faqError ? (
        <Pressable onPress={() => void loadFAQ()} style={styles.retry} accessibilityRole="button">
          <Text style={styles.error}>{faqError} Try again</Text>
        </Pressable>
      ) : faqLoading && faq.length === 0 ? (
        <Text style={styles.answer}>Loading questions…</Text>
      ) : faq.length === 0 ? (
        <Text style={styles.answer}>No questions have been published yet.</Text>
      ) : null}
      <Card style={styles.faqCard}>
        {faq.map((item) => {
          const isExpanded = expanded === faq.findIndex((entry) => entry.id === item.id);
          const Chevron = isExpanded ? ChevronUp : ChevronDown;
          return (
            <View key={item.id} style={styles.faqItem}>
              <Pressable
                onPress={() => setExpanded(isExpanded ? null : faq.findIndex((entry) => entry.id === item.id))}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${item.question}${isExpanded ? ', expanded' : ''}`}
                style={styles.question}
              >
                <Text style={styles.questionText}>{item.question}</Text>
                <Chevron size={20} color={colors.textSecondary} />
              </Pressable>
              {isExpanded ? <Text style={styles.answer}>{item.answer}</Text> : null}
            </View>
          );
        })}
      </Card>

      <Card style={styles.versionCard}>
        <Text style={styles.version}>{settings.appName} · Version {appVersion}</Text>
        <Button label="Report a problem" variant="outline" onPress={reportProblem} />
      </Card>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  contacts: { padding: Spacing.two, gap: 2 },
  sectionTitle: { color: colors.text, ...typography.heading, marginTop: Spacing.three },
  faqCard: { paddingHorizontal: Spacing.four },
  faqItem: { borderBottomWidth: 1, borderBottomColor: colors.border },
  question: { minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  questionText: { flex: 1, color: colors.text, ...typography.label },
  answer: { color: colors.textSecondary, ...typography.body, lineHeight: 22, paddingBottom: Spacing.four },
  versionCard: { gap: Spacing.three },
  version: { color: colors.textSecondary, ...typography.caption },
  retry: { minHeight: 48, justifyContent: 'center' },
  error: { color: colors.danger, ...typography.caption },
});
