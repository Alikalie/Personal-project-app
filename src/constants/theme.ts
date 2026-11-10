import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: '#208AEF',
    primaryDark: '#0F5CC1',
    primaryLight: '#EAF5FF',
    border: '#DCE3EE',
    danger: '#D94E4E',
    warning: '#E29D1E',
    success: '#2FA76A',
    white: '#FFFFFF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: '#208AEF',
    primaryDark: '#0F5CC1',
    primaryLight: '#EAF5FF',
    border: '#DCE3EE',
    danger: '#D94E4E',
    warning: '#E29D1E',
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
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const colors = {
  primary: '#208AEF',
  primaryDark: '#0F5CC1',
  primaryLight: '#EAF5FF',
  text: '#1B2430',
  textSecondary: '#5E6A7B',
  background: '#F4F7FB',
  white: '#FFFFFF',
  border: '#DCE3EE',
  danger: '#D94E4E',
  warning: '#E29D1E',
  success: '#2FA76A',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadow = {
  shadowColor: '#0B1320',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
};
