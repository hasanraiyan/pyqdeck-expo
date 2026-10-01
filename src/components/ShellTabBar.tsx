import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme/colors';

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
export function ShellTabBar({ width, collapsible, collapsed, onToggle, ...barProps }: Props) {
  return (
    <View style={[styles.column, { width, minWidth: width, maxWidth: width }]}>
      {collapsible && (
        <View style={[styles.toggleRow, collapsed && styles.toggleRowCollapsed]}>
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
        </View>
      )}
      <BottomTabBar {...barProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  toggleRowCollapsed: { justifyContent: 'center' },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: COLORS.border },
});
