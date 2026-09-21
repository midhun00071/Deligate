import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme/tokens';

interface ListRowProps {
  title: string;
  detail?: string;
  onPress?: () => void;
}

export function ListRow({ title, detail, onPress }: ListRowProps) {
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        style={styles.row}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.xs,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    color: colors.inkMuted,
    fontSize: 24,
  },
});
