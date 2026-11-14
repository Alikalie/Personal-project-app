import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17251D',
    background: '#F7FAF8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EAF5EE',
    textSecondary: '#748078',
    primary: '#16864A',
    primaryDark: '#0B5933',
    primaryLight: '#EAF5EE',
    border: '#E3EBE5',
    danger: '#DC4545',
    warning: '#E6A23C',
    success: '#2FA76A',
    white: '#FFFFFF',
  },
  dark: {
    text: '#17251D',
    background: '#0B5933',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#748078',
    primary: '#16864A',
    primaryDark: '#0B5933',
    primaryLight: '#EAF5EE',
    border: '#E3EBE5',
    danger: '#DC4545',
    warning: '#E6A23C',
    success: '#2FA76A',
    white: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const colors = {
  primary: '#16864A',
  primaryDark: '#0B5933',
  primaryLight: '#EAF5EE',
  text: '#17251D',
  textSecondary: '#748078',
  background: '#F7FAF8',
  white: '#FFFFFF',
  border: '#E3EBE5',
  danger: '#DC4545',
  warning: '#E6A23C',
  success: '#2FA76A',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadow = {
  shadowColor: '#0B1320',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
};

export const typography = {
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 26, fontWeight: '800' as const },
  heading: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, fontWeight: '800' as const },
  body: { fontFamily: 'Inter_500Medium', fontSize: 15, fontWeight: '500' as const },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, fontWeight: '600' as const },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500' as const },
} as const;

export const minTouchTarget = 48;
