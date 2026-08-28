import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Backend from '../api/backend';
import { COLORS, FONTS } from '../theme/colors';

// Dev-only strip showing which backend the app is talking to, with buttons to
// force one. Exists because backend selection is otherwise invisible - the
// whole point of the EC2/Render split is that the app silently switches, which
// is exactly what makes it hard to verify by hand in Expo Go.
//
// Never renders in a release build: App.tsx returns the pre-existing tree
// unchanged when !__DEV__, and this component returns null on the same check.
// The code itself does still ship - Metro does not tree-shake it out, and
// grepping a release .hbc finds these style names - but nothing mounts it and
// setPinned() is inert, so it cannot affect a production app.
export function BackendDebugBanner() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(Backend.getState);

  useEffect(() => {
    // Re-read on every selection change: startup resolution, a failover, or a
    // pin from the buttons below.
    const unsubscribe = Backend.subscribe(() => setState(Backend.getState()));
    return unsubscribe;
  }, []);

  // Belt and braces - App.tsx already gates the mount on __DEV__. Placed
  // after the hooks so hook order stays constant either way.
  if (!__DEV__) return null;

  // Strip the scheme - the host is the only part that differs, and the bar is
  // narrow.
  const host = state.root.replace(/^https?:\/\//, '');

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]}>
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          <Text style={styles.dot}>{state.pinned ? '◉ ' : '○ '}</Text>
          {host}
        </Text>

        <View style={styles.buttons}>
          <Chip
            text="AUTO"
            active={!state.pinned}
            onPress={() => Backend.setPinned(null)}
          />
          {Backend.listOrigins().map((origin) => (
            <Chip
              key={origin.id}
              text={origin.label.toUpperCase()}
              active={state.pinned && state.id === origin.id}
              onPress={() => Backend.setPinned(origin.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 10,
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  dot: {
    color: COLORS.accent,
  },
  buttons: {
    flexDirection: 'row',
    gap: 4,
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipPressed: {
    opacity: 0.6,
  },
  chipText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#ffffff',
  },
});
