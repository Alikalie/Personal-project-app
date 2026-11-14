import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { Badge, IconButton, ScreenHeader, Skeleton } from '@/components/ds';
import { Button } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { endSupportAccess, getSavedSupportAccess, type SupportAccessSession } from '@/services/supportAccessService';

export function AdminScreen({
  title,
  subtitle,
  children,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  rightAction?: ReactNode;
}) {
  const [supportAccess, setSupportAccess] = useState<SupportAccessSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [endingSupportAccess, setEndingSupportAccess] = useState(false);
  const [supportError, setSupportError] = useState('');
  const expirationHandled = useRef<string | null>(null);

  const loadSupportAccess = useCallback(async () => {
    setSupportAccess(await getSavedSupportAccess());
  }, []);

  useEffect(() => {
    void loadSupportAccess().catch((error: unknown) => {
      console.warn('Support access status could not be loaded:', error);
      setSupportError('Support access status could not be checked.');
    });
  }, [loadSupportAccess]);

  useEffect(() => {
    if (!supportAccess) return;
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((supportAccess.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && expirationHandled.current !== supportAccess.id) {
        expirationHandled.current = supportAccess.id;
        void endSupportAccess(supportAccess.id).then(() => setSupportAccess(null)).catch((error: unknown) => {
          console.warn('Expired support session could not be ended:', error);
          setSupportError('Support access expired. End the session again or retry.');
        });
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [supportAccess]);

  const endSupport = async () => {
    if (!supportAccess || endingSupportAccess) return;
    setEndingSupportAccess(true);
    setSupportError('');
    expirationHandled.current = supportAccess.id;
    try {
      await endSupportAccess(supportAccess.id);
      setSupportAccess(null);
    } catch (error) {
      expirationHandled.current = null;
      console.warn('Support access could not be ended:', error);
      setSupportError('Could not end support access. Try again.');
    } finally {
      setEndingSupportAccess(false);
    }
  };
  const timer = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.page}>
        {supportAccess ? (
          <View style={styles.supportBanner}>
            <Text style={styles.supportText}>
              Support access: {supportAccess.businessName}, expires in {timer}
            </Text>
            <Pressable onPress={() => void endSupport()} disabled={endingSupportAccess} style={styles.supportEnd} accessibilityRole="button">
              <Text style={styles.supportEndText}>{endingSupportAccess ? 'Ending…' : 'End now'}</Text>
            </Pressable>
          </View>
        ) : null}
        {supportError ? <Text style={styles.errorText}>{supportError}</Text> : null}
        <ScreenHeader title={title} subtitle={subtitle} onBack={onBack ?? (() => router.back())} rightAction={rightAction} />
        {children}
      </View>
    </SafeAreaView>
  );
}

export function AdminLoading({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.loading}>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} height={72} radius={14} />)}
    </View>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

export function AdminEmpty({ message }: { message: string }) {
  return <Text style={styles.empty}>{message}</Text>;
}

export function AdminSearch({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      style={styles.search}
      returnKeyType="search"
      accessibilityLabel={placeholder}
    />
  );
}

export function AdminFilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option.value)}
          style={[styles.chip, selected === option.value && styles.chipSelected]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === option.value }}
        >
          <Text style={[styles.chipText, selected === option.value && styles.chipTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function AdminCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AdminInitials({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?';
  return <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>;
}

export function AdminMetric({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'danger' | 'warning';
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.metric, tone === 'danger' && styles.metricDanger, tone === 'warning' && styles.metricWarning]}>
      {Icon ? <Icon size={18} color={tone === 'danger' ? colors.danger : colors.primaryDark} /> : null}
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{String(value)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>{content}</Pressable>
    : content;
}

export function AdminStatusBadge({ label, tone }: { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }) {
  return <Badge label={label} tone={tone} />;
}

export function AdminReasonModal({
  visible,
  title,
  description,
  actionLabel,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description: string;
  actionLabel: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const choices = ['Policy violation', 'User request', 'Other'];
  const close = () => {
    if (loading) return;
    setReason('');
    onClose();
  };
  const confirm = async () => {
    if (reason.trim().length < 3 || loading) return;
    try {
      await onConfirm(reason.trim());
      setReason('');
    } catch {
      // The parent displays the action error and leaves this form open for correction or retry.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel="Close confirmation" />
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalDescription}>{description}</Text>
          <Text style={styles.modalLabel}>Reason (required)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Type a reason"
            placeholderTextColor={colors.textSecondary}
            style={styles.reasonInput}
            accessibilityLabel="Reason for account status change"
          />
          <View style={styles.choices}>
            {choices.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setReason(choice)}
                style={[styles.choice, reason === choice && styles.choiceSelected]}
                accessibilityRole="button"
              >
                <Text style={[styles.choiceText, reason === choice && styles.choiceTextSelected]}>{choice}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button
            label={actionLabel}
            onPress={() => void confirm()}
            loading={loading}
            disabled={loading || reason.trim().length < 3}
          />
          <Button label="Keep as is" variant="outline" onPress={close} disabled={loading} />
        </View>
      </View>
    </Modal>
  );
}

export function AdminReason({ label }: { label: string | null }) {
  if (!label) return null;
  return <Text style={styles.reason}>{label}</Text>;
}

export function formatAdminDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-SL', { dateStyle: 'medium' }).format(date);
}

export function relativeAdminDate(value: string | null): string {
  if (!value) return 'No activity recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function adminRowDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const now = new Date();
  const today = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat('en-SL', { hour: 'numeric', minute: '2-digit' }).format(date);
  return today
    ? `Today, ${time}`
    : new Intl.DateTimeFormat('en-SL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function smallCode(value: string | null | undefined): string {
  return value?.trim() || 'Code unavailable';
}

export function adminReasonDetails(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return null;
  const details = value as Record<string, unknown>;
  for (const key of ['reason', 'details', 'message']) {
    if (typeof details[key] === 'string' && details[key].trim()) return details[key].trim();
  }
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, paddingHorizontal: Spacing.five, paddingBottom: Spacing.two },
  loading: { gap: Spacing.two, paddingTop: Spacing.two },
  state: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: Spacing.three, padding: Spacing.five },
  errorText: { color: colors.danger, ...typography.body, textAlign: 'center' },
  supportBanner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: radius.md, backgroundColor: colors.danger },
  supportText: { flex: 1, color: colors.white, ...typography.label },
  supportEnd: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.two },
  supportEndText: { color: colors.white, ...typography.label, textDecorationLine: 'underline' },
  empty: { color: colors.textSecondary, ...typography.body, textAlign: 'center', paddingVertical: Spacing.seven },
  search: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: Spacing.three, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.text, ...typography.body },
  chips: { gap: Spacing.two, paddingVertical: Spacing.two },
  chip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, ...typography.label },
  chipTextSelected: { color: colors.primaryDark },
  card: { padding: Spacing.four, borderRadius: radius.lg, backgroundColor: colors.white },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
  metric: { minHeight: 100, flex: 1, gap: 5, justifyContent: 'center', padding: Spacing.three, borderRadius: radius.md, backgroundColor: colors.white },
  metricDanger: { backgroundColor: '#FDE9E9' },
  metricWarning: { backgroundColor: '#FFF3DC' },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: colors.textSecondary, ...typography.caption },
  modalRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.five },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)' },
  modal: { padding: Spacing.five, borderRadius: radius.lg, backgroundColor: colors.white, gap: Spacing.three },
  modalTitle: { color: colors.text, ...typography.heading },
  modalDescription: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  modalLabel: { color: colors.text, ...typography.label },
  reasonInput: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: Spacing.three, color: colors.text, ...typography.body },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceText: { color: colors.textSecondary, ...typography.caption },
  choiceTextSelected: { color: colors.primaryDark },
  reason: { color: colors.danger, ...typography.body, padding: Spacing.three, borderRadius: radius.md, backgroundColor: '#FDE9E9' },
});
