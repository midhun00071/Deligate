import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/theme/tokens';

type Tone = 'neutral' | 'muted' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <View accessibilityLabel={`Status: ${label}`} style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, tone === 'danger' && styles.dangerText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  neutral: {
    backgroundColor: colors.background,
  },
  muted: {
    backgroundColor: colors.muted,
  },
  danger: {
    backgroundColor: '#FFF7F7',
    borderColor: '#E6B9B9',
  },
  text: {
    color: colors.inkSecondary,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  dangerText: {
    color: colors.danger,
  },
});
