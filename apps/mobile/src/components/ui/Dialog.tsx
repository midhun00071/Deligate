import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

import { Button } from './Button';

interface DialogProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
}

export function Dialog({ visible, title, children, onDismiss }: DialogProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          accessibilityViewIsModal
          style={styles.panel}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={type.title}>{title}</Text>
          <View style={styles.content}>{children}</View>
          <Button label="Close" variant="secondary" onPress={onDismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    maxWidth: 480,
    padding: spacing.lg,
    width: '100%',
  },
  content: {
    marginVertical: spacing.md,
  },
});
