import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  safeEdges?: Edge[];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  scrollRef?: Ref<ScrollView>;
}

export function Screen({
  children,
  scroll = true,
  safeEdges = ['top', 'bottom'],
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  scrollRef,
}: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView edges={safeEdges} style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode={keyboardDismissMode}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          ref={scrollRef}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.subtle,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.contentMaxWidth,
    padding: spacing.lg,
    width: '100%',
  },
});
