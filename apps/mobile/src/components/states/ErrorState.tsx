import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { radii, spacing, type } from '@/theme/tokens';

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load this information',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.wrap}>
      <Text style={type.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#FFF9F9',
    borderColor: '#E6B9B9',
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 200,
    padding: spacing.lg,
  },
  description: {
    ...type.body,
    maxWidth: 410,
    textAlign: 'center',
  },
});
