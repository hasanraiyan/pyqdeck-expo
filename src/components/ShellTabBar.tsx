import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth, useUser } from '@clerk/expo';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { isAuthEnabled } from '../config/features';

interface Props extends BottomTabBarProps {
  /** Total width of the rail / sidebar column. */
  width: number;
  /** Show the collapse / expand button (laptop and up only). */
  collapsible: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Left rail / sidebar: the stock tab bar plus a collapse toggle above it.
 * React Navigation's bar has no slot for extra controls, so it is wrapped
 * rather than replaced, and keeps its own item rendering and a11y.
 */
/** Footer row: icon plus label when expanded, icon only on the rail. */
function FooterItem({
  icon,
  label,
  expanded,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.footerItem,
        !expanded && styles.footerItemRail,
        (pressed || hovered) && styles.footerItemActive,
      ]}
    >
      <Feather name={icon} size={20} color={COLORS.textMuted} />
      {expanded && (
        <Text style={styles.footerLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// Only mounted when auth is enabled, so the Clerk hooks are always called.
function AccountItem({ expanded, onPress }: { expanded: boolean; onPress: (signedIn: boolean) => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  if (!isLoaded) return null;
  const name = user?.firstName || user?.primaryEmailAddress?.emailAddress || 'Account';
  return (
    <FooterItem
      icon="user"
      label={isSignedIn ? name : 'Sign in'}
      expanded={expanded}
      onPress={() => onPress(!!isSignedIn)}
    />
  );
}

/**
 * Left rail / sidebar: the stock tab bar plus a logo and collapse toggle above
 * it and Settings and account below (FR-N4, FR-N5). React Navigation's bar has
 * no slot for extra controls, so it is wrapped rather than replaced, and keeps
 * its own item rendering and a11y.
 */
export function ShellTabBar({ width, collapsible, collapsed, onToggle, ...barProps }: Props) {
  const expanded = width > 100;
  const rootNav = barProps.navigation.getParent() ?? barProps.navigation;
  return (
    <View style={[styles.column, { width, minWidth: width, maxWidth: width }]}>
      <View style={[styles.topRow, !expanded && styles.topRowRail]}>
        <View style={styles.brand}>
          <Image source={require('../../assets/app-icon.png')} style={styles.logo} />
          {expanded && <Text style={styles.brandText}>PyQdeck</Text>}
        </View>
        {collapsible && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onToggle();
            }}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            hitSlop={8}
            style={({ pressed, hovered }: any) => [
              styles.toggle,
              (pressed || hovered) && styles.toggleActive,
            ]}
          >
            <Feather
              name={collapsed ? 'chevrons-right' : 'chevrons-left'}
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.bar}>
        <BottomTabBar {...barProps} />
      </View>
      <View style={[styles.footer, !expanded && styles.footerRail]}>
        <FooterItem
          icon="settings"
          label="Settings"
          expanded={expanded}
          onPress={() => barProps.navigation.navigate('Browse', { screen: 'Settings' })}
        />
        {isAuthEnabled && (
          <AccountItem
            expanded={expanded}
            onPress={(signedIn) => rootNav.navigate(signedIn ? 'ManageAccount' : 'SignIn')}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  // Rail: logo above the toggle, centred.
  topRowRail: { flexDirection: 'column', justifyContent: 'center', gap: 10, paddingHorizontal: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 7 },
  brandText: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
  // The tab bar takes the space between header and footer.
  bar: { flex: 1 },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerRail: { paddingHorizontal: 8, alignItems: 'center' },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerItemRail: { width: 56, justifyContent: 'center', paddingHorizontal: 0 },
  footerItemActive: { backgroundColor: COLORS.border },
  footerLabel: { flexShrink: 1, fontSize: 14, color: COLORS.text },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: COLORS.border },
});
