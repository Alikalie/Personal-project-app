import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Mail, MessageCircle, Phone } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { Card, ListRow } from '@/components/ds';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { usePublicAppSettings } from '@/components/PublicAppSettingsProvider';
import { colors, minTouchTarget, Spacing, typography } from '@/constants/theme';

const faq = [
  { question: 'How do I add a product?', answer: 'Open the Stock tab and tap Add product. Enter its details and save.' },
  { question: 'How do I record a credit sale?', answer: 'Add items to a sale, choose a customer in the cart, then select Credit at payment.' },
  { question: 'How do I record a repayment?', answer: 'Repayment recording will be available in the Customers module in a future release.' },
  { question: 'How do I check my profit?', answer: 'Open the Home dashboard or sale details. Profit figures are available to owners and managers.' },
  { question: 'How do I change my password?', answer: 'Open More, choose Change password, and enter your new password twice.' },
];

export default function HelpSettings() {
  const { ctx } = useAuth();
  const { settings } = usePublicAppSettings();
  const [expanded, setExpanded] = useState<number | null>(null);
  const appVersion = Constants.expoConfig?.version ?? 'Unknown';

  const openContact = async (url: string, title: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn(`Unable to open ${title} contact link`, error);
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
      <Card style={styles.faqCard}>
        {faq.map((item, index) => {
          const isExpanded = expanded === index;
          const Chevron = isExpanded ? ChevronUp : ChevronDown;
          return (
            <View key={item.question} style={styles.faqItem}>
              <Pressable
                onPress={() => setExpanded(isExpanded ? null : index)}
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
});
