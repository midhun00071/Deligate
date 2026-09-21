import type { AppRole } from '@deligate/types';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, StatusBadge } from '@/components/ui';
import { colors, layout, spacing } from '@/theme/tokens';

import { ShellNavigation } from './ShellNavigation';
import { roleLabels } from './paths';

interface AppShellProps {
  role: AppRole;
  children: ReactNode;
}

export function AppShell({ role, children }: AppShellProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [navOpen, setNavOpen] = useState(false);
  const wide = width >= 860;
  const compactDesktop = wide && width < 1080;
  const topInset = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={styles.page}>
      {wide ? (
        <ShellNavigation compactDesktop={compactDesktop} role={role} topInset={topInset} />
      ) : null}

      <View style={styles.main}>
        <View
          style={[
            styles.topbar,
            {
              height: layout.topbar + topInset,
              paddingTop: topInset,
            },
          ]}
        >
          {!wide ? (
            <Button label="Menu" variant="ghost" onPress={() => setNavOpen(true)} />
          ) : null}
          <Text style={styles.topbarTitle}>{roleLabels[role]}</Text>
          <StatusBadge label="Sandbox" tone="muted" />
        </View>
        {children}
      </View>

      {!wide && navOpen ? (
        <Pressable
          accessibilityLabel="Close navigation"
          onPress={() => setNavOpen(false)}
          style={styles.backdrop}
        />
      ) : null}
      {!wide ? (
        <ShellNavigation
          compactDesktop={false}
          drawer
          open={navOpen}
          role={role}
          topInset={topInset}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.subtle,
    flex: 1,
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  topbar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: layout.topbar,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topbarTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
