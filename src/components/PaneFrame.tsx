import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

const COLLAPSED_WIDTH = 44;

interface Props {
  width: number;
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Extra header buttons, left of the collapse button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** A small square icon button used in pane headers. */
export function PaneIconButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed, hovered }: any) => [
        styles.iconBtn,
        active && styles.iconBtnActive,
        (pressed || hovered) && styles.iconBtnHover,
      ]}
    >
      <Feather name={icon} size={16} color={active ? COLORS.primary : COLORS.textMuted} />
    </Pressable>
  );
}

/**
 * Shared chrome for the list pane beside a detail screen: a header with the
 * title, extra actions and a button that folds the whole pane sideways to a
 * thin strip, handing its width to the detail (collapse in the x direction).
 * Children are unmounted while folded, so a long list costs nothing.
 */
export function PaneFrame({
  width,
  title,
  subtitle,
  collapsed,
  onToggleCollapsed,
  actions,
  children,
}: Props) {
  if (collapsed) {
    return (
      <View style={[styles.strip, { width: COLLAPSED_WIDTH, minWidth: COLLAPSED_WIDTH }]}>
        <PaneIconButton icon="chevrons-right" label={`Show ${title}`} onPress={onToggleCollapsed} />
        <Text style={styles.stripLabel} numberOfLines={1}>
          {title}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.pane, { width, minWidth: width, maxWidth: width }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions}
        <PaneIconButton icon="chevrons-left" label="Hide list" onPress={onToggleCollapsed} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  strip: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    alignItems: 'center',
    paddingTop: 12,
    gap: 14,
  },
  // Reads top to bottom beside the expand button, so the strip says what it holds.
  stripLabel: {
    width: 160,
    minWidth: 160,
    flexShrink: 0,
    textAlign: 'left',
    fontSize: rf(12),
    color: COLORS.textMuted,
    transform: [{ rotate: '90deg' }, { translateX: 78 }, { translateY: -4 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONTS.serif, fontSize: rf(18), color: COLORS.text },
  subtitle: { marginTop: 2, fontSize: rf(11), color: COLORS.textMuted },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: COLORS.background },
  iconBtnHover: { backgroundColor: COLORS.border },
});
