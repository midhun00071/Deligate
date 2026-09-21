import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  subtle: '#FCFCFB',
  muted: '#F6F6F5',
  mutedStrong: '#F0F0EE',
  ink: '#0B0B0C',
  inkSecondary: '#3D3D42',
  inkMuted: '#6F6F76',
  inkLight: '#A2A2A8',
  inkFaint: '#C9C9CD',
  line: '#ECECEA',
  lineStrong: '#DEDCD9',
  lineStrongest: '#C4C2BE',
  danger: '#A51D1D',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radii = {
  sm: 5,
  base: 7,
  md: 9,
  lg: 12,
} as const;

export const shadows: Record<'surface', ViewStyle> = {
  surface: {
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
};

export const type: Record<'eyebrow' | 'body' | 'small' | 'title' | 'display' | 'mono', TextStyle> = {
  eyebrow: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  body: {
    color: colors.inkSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  small: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  display: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  mono: {
    color: colors.inkMuted,
    fontFamily: 'monospace',
    fontSize: 12,
  },
};

export const layout = {
  desktopSidebar: 250,
  compactSidebar: 66,
  topbar: 56,
  contentMaxWidth: 1180,
  phoneTouchTarget: 44,
} as const;
