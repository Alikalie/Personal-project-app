import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react-native';

import { colors, minTouchTarget, radius, shadow, Spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

/** A padded rounded surface for grouping related content. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A compact metric card with an optional trend label. */
export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  tone = 'primary',
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
  tone?: BadgeTone | 'primary';
  onPress?: () => void;
}) {
  const tint = toneColor(tone);
  const content = (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: toneBackground(tone) }]}>
        <Icon size={19} color={tint} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {trend ? <Text style={[styles.statTrend, { color: tint }]}>{trend}</Text> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      {content}
    </Pressable>
  );
}

/** A section title with an optional accessible trailing action. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.sectionAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A touch-friendly list item with an icon or image and optional trailing content. */
export function ListRow({
  icon: Icon,
  image,
  leadingLabel,
  title,
  subtitle,
  trailingValue,
  badge,
  chevron = false,
  onPress,
  accessibilityLabel,
}: {
  icon?: LucideIcon;
  image?: string | null;
  leadingLabel?: string;
  title: string;
  subtitle?: string;
  trailingValue?: string;
  badge?: { label: string; tone: BadgeTone };
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {image ? (
        <Image source={{ uri: image }} style={styles.rowImage} />
      ) : leadingLabel ? (
        <View style={styles.avatar}><Text style={styles.avatarText}>{leadingLabel}</Text></View>
      ) : Icon ? (
        <View style={styles.rowIcon}><Icon size={19} color={colors.primary} /></View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailingValue ? <Text style={styles.rowValue} numberOfLines={1}>{trailingValue}</Text> : null}
      {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      {chevron ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}${subtitle ? `, ${subtitle}` : ''}`}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** A labelled status badge with a semantic tone. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <View style={[styles.badge, { backgroundColor: toneBackground(tone) }]}>
      <Text style={[styles.badgeText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  );
}

/** An icon-led empty state with an optional action button. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Icon size={28} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? <View style={styles.emptyAction}><Button label={actionLabel} onPress={onAction} /></View> : null}
    </View>
  );
}

/** An animated, screen-reader-hidden placeholder block. */
export function Skeleton({ width = '100%', height = 16, radius: cornerRadius = 8, style }: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: cornerRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

/** A shared screen title row with an optional accessible action. */
export function ScreenHeader({
  title,
  subtitle,
  rightAction,
  onBack,
}: {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBack} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.screenHeaderText}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction}
    </View>
  );
}

/** A selectable chip with a visible selected state. */
export function Chip({ label, selected, onPress, icon: Icon }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {Icon ? <Icon size={15} color={selected ? colors.primaryDark : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** A floating action button hidden when the user is not permitted to act. */
export function FAB({ label, onPress, allowed = true, icon: Icon = Plus }: {
  label: string;
  onPress: () => void;
  allowed?: boolean;
  icon?: LucideIcon;
}) {
  if (!allowed) return null;
  return (
    <Pressable onPress={onPress} style={styles.fab} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={20} color={colors.white} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

/** A 48-point accessible icon-only button. */
export function IconButton({ icon: Icon, label, onPress, disabled = false }: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon size={20} color={colors.primaryDark} />
    </Pressable>
  );
}

function toneColor(tone: BadgeTone | 'primary'): string {
  if (tone === 'success' || tone === 'primary') return colors.primaryDark;
  if (tone === 'warning') return '#815000';
  if (tone === 'danger') return '#A32121';
  return colors.textSecondary;
}

function toneBackground(tone: BadgeTone | 'primary'): string {
  if (tone === 'success' || tone === 'primary') return colors.primaryLight;
  if (tone === 'warning') return '#FFF3DC';
  if (tone === 'danger') return '#FDE9E9';
  return '#EEF2EF';
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: Spacing.four, ...shadow },
  statCard: { minHeight: 92, flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: Spacing.three, ...shadow },
  statIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { color: colors.textSecondary, ...typography.caption, marginTop: 2 },
  statTrend: { ...typography.caption, marginTop: 4 },
  sectionHeader: { minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, ...typography.heading },
  sectionAction: { minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.two },
  actionText: { color: colors.primaryDark, ...typography.label },
  listRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: colors.white, borderRadius: radius.lg },
  rowImage: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primaryLight },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typography.label },
  rowSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  rowValue: { color: colors.text, ...typography.label, flexShrink: 1 },
  badge: { minHeight: 28, paddingHorizontal: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { ...typography.caption, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.six, minHeight: 230 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  emptyTitle: { marginTop: Spacing.four, textAlign: 'center', color: colors.text, ...typography.heading },
  emptyMessage: { marginTop: Spacing.two, textAlign: 'center', color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  emptyAction: { width: '100%', maxWidth: 300, marginTop: Spacing.four },
  screenHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerBack: { width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.white },
  screenHeaderText: { flex: 1 },
  screenTitle: { color: colors.text, ...typography.title },
  screenSubtitle: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  chip: { minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.four, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, ...typography.label },
  chipTextSelected: { color: colors.primaryDark },
  fab: { position: 'absolute', right: Spacing.four, bottom: Spacing.four, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.four, borderRadius: 28, backgroundColor: colors.primary, ...shadow },
  fabText: { color: colors.white, ...typography.label },
  iconButton: { width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.white },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});
