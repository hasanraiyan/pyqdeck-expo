import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

// Claude Code's own spinner: forward through the sequence, then back, so the
// glyph breathes instead of looping with a jump. Same frame set as the web
// reference (NotebookChat's AssistantThinking).
const SPINNER_BASE = ['·', '✢', '*', '✶', '✻', '✽'];
const SPINNER_FRAMES = [...SPINNER_BASE, ...[...SPINNER_BASE].reverse()];

const FRAME_MS = 120;
// Seconds before the label switches from a pulsing "…" to a live "· Ns".
const SHOW_TIMER_AFTER_S = 2;

interface Props {
  /** Replaces "Thinking" when the server reports what it is doing. */
  label?: string;
}

/**
 * Shown between sending a question and the first word of the answer (and as
 * the overview card's loading state). Two intervals, both cleaned up on
 * unmount: one steps the glyph, one counts elapsed seconds.
 *
 * With the OS reduce-motion setting on, the glyph and dots stop moving and
 * the label is static "Thinking…", so nothing flickers for people who asked
 * for less motion.
 */
export const ThinkingIndicator: React.FC<Props> = ({ label }) => {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), FRAME_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // The "…" pulse only matters before the timer takes over.
  useEffect(() => {
    if (reduceMotion || elapsed > SHOW_TIMER_AFTER_S) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, elapsed > SHOW_TIMER_AFTER_S, pulse]);

  const text = label?.trim() || 'Thinking';
  const showTimer = !reduceMotion && elapsed > SHOW_TIMER_AFTER_S;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Thinking"
      accessibilityLiveRegion="polite"
    >
      {/* Fixed-width box: glyphs differ in width, and a jittering label
          beside the spinner reads as a glitch. */}
      <Text style={styles.glyph} importantForAccessibility="no">
        {reduceMotion ? '✻' : SPINNER_FRAMES[frame]}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {text}
        {showTimer ? ` · ${elapsed}s` : null}
      </Text>
      {!showTimer && (
        <Animated.Text style={[styles.label, { opacity: reduceMotion ? 1 : pulse }]}>…</Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  glyph: {
    width: 16,
    textAlign: 'center',
    fontFamily: FONTS.mono,
    fontSize: rf(15),
    color: COLORS.text,
  },
  label: {
    fontFamily: FONTS.sans,
    fontSize: rf(12),
    fontWeight: '500',
    letterSpacing: -0.1,
    color: COLORS.textMuted,
  },
});
