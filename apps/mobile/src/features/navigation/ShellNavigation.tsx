import type { AppRole } from '@deligate/types';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

import { roleLabels } from './paths';

interface ShellNavigationProps {
  role: AppRole;
  compactDesktop: boolean;
  topInset: number;
  drawer?: boolean;
  open?: boolean;
}

export function ShellNavigation({
  role,
  compactDesktop,
  topInset,
  drawer = false,
  open = false,
}: ShellNavigationProps) {
  const { actor, signOut } = useAuth();

  return (
    <View
      style={[
        styles.sidebar,
        { paddingTop: spacing.md + topInset },
        compactDesktop && styles.compactSidebar,
        drawer && styles.drawer,
        drawer && open && styles.drawerOpen,
      ]}
    >
      <Text
        accessibilityLabel="Deligate"
        style={[styles.brand, compactDesktop && styles.compactBrand]}
      >
        {compactDesktop ? 'D' : 'Deligate'}
      </Text>
      {!compactDesktop ? <Text style={styles.workspace}>{roleLabels[role]}</Text> : null}

      <View style={styles.links}>
        <NavItem active compact={compactDesktop} label="Overview" />
        <NavItem
          compact={compactDesktop}
          label={
            role === 'DELIVERY_ADMIN'
              ? 'Rider records'
              : role === 'BUILDING_SECURITY'
                ? 'Verification desk'
                : 'Account status'
          }
        />
        <NavItem compact={compactDesktop} label="Activity" />
      </View>

      <View style={[styles.user, compactDesktop && styles.compactUser]}>
        {!compactDesktop ? (
          <Text numberOfLines={1} style={styles.name}>
            {actor?.displayName ?? 'Operator'}
          </Text>
        ) : null}
        {compactDesktop ? (
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={styles.compactSignOut}
          >
            <Text style={styles.compactSignOutLabel}>↗</Text>
          </Pressable>
        ) : (
          <Button
            accessibilityLabel="Sign out"
            label="Sign out"
            variant="ghost"
            onPress={() => void signOut()}
          />
        )}
      </View>
    </View>
  );
}

function NavItem({
  label,
  active,
  compact,
}: {
  label: string;
  active?: boolean;
  compact: boolean;
}) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.navItem, compact && styles.compactNavItem, active && styles.navActive]}
    >
      <Text style={styles.navMark}>{compact ? label.slice(0, 1) : '—'}</Text>
      {!compact ? <Text style={styles.navText}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: colors.background,
    borderRightColor: colors.line,
    borderRightWidth: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
    width: layout.desktopSidebar,
    zIndex: 2,
  },
  compactSidebar: {
    width: layout.compactSidebar,
  },
  drawer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -280 }],
    width: 262,
  },
  drawerOpen: {
    transform: [{ translateX: 0 }],
  },
  brand: {
    ...type.title,
    fontSize: 19,
  },
  compactBrand: {
    alignSelf: 'center',
    fontSize: 20,
  },
  workspace: {
    ...type.small,
    marginTop: 3,
  },
  links: {
    flex: 1,
    gap: 4,
    marginTop: spacing.xl,
  },
  navItem: {
    alignItems: 'center',
    borderRadius: radii.base,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  compactNavItem: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navActive: {
    backgroundColor: colors.muted,
  },
  navMark: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  navText: {
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  user: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  compactUser: {
    alignItems: 'center',
  },
  name: {
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  compactSignOut: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'web' ? 36 : 44,
    minWidth: Platform.OS === 'web' ? 36 : 44,
  },
  compactSignOutLabel: {
    color: colors.inkMuted,
    fontSize: 18,
  },
});
