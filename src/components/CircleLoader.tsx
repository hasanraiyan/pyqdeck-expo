import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../theme/colors';

interface CircleLoaderProps {
  color?: string;
  dotSize?: number;
  /** Outer diameter of the ring the dots travel on. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// WaveLoader's numbers, kept identical so the two read as one family: a 4s
// loop on the same bezier, with each dot a fifth of a second behind the one
// in front (200ms of 4000ms = 0.05 of a cycle).
const DURATION = 4000;
const PHASE_STEP = 0.05;
const DOT_COUNT = 6;
const EASING = Easing.bezier(0.03, 0.615, 0.995, 0.415);

interface CircleDotProps {
  /** Where in the shared cycle this dot begins, 0-1. */
  startPhase: number;
  color: string;
  size: number;
  radius: number;
}

/**
 * One dot of the ring. Identical in behaviour to WaveDot - fade in, travel,
 * fade out, repeat - with the -30..+30px slide swapped for a -180..+180deg
 * sweep so the same motion runs around a circle instead of across a line.
 *
 * The one real difference is how the stagger is applied. WaveDot waits out
 * its delay on a setTimeout before starting, which is invisible on a line but
 * not on a ring: for the first second only one or two dots exist, so a short
 * fetch shows a stray pair rather than a circle. Here each dot instead starts
 * immediately from an offset phase, so the ring is fully formed on the first
 * frame and the steady-state look is the only look.
 */
const CircleDot: React.FC<CircleDotProps> = ({ startPhase, color, size, radius }) => {
  const anim = useRef(new Animated.Value(startPhase)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    // Finish the partial first cycle this dot starts mid-way through, then
    // hand over to the plain looping one so every dot stays in step.
    const lead = Animated.timing(anim, {
      toValue: 1,
      duration: DURATION * (1 - startPhase),
      easing: EASING,
      useNativeDriver: true,
    });

    lead.start(({ finished }) => {
      if (!finished) return;
      anim.setValue(0);
      loop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: DURATION,
          easing: EASING,
          useNativeDriver: true,
        })
      );
      loop.start();
    });

    return () => {
      lead.stop();
      loop?.stop();
    };
  }, [anim, startPhase]);

  // Same keyframes as WaveDot, one full revolution in place of the slide.
  const rotate = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 1],
    outputRange: ['-180deg', '0deg', '180deg', '180deg'],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 1],
    outputRange: [0, 1, 0, 0],
  });

  return (
    <Animated.View style={[styles.arm, { transform: [{ rotate }] }]}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateY: -radius }],
        }}
      />
    </Animated.View>
  );
};

/**
 * Circular sibling of WaveLoader, for a loader that owns the whole empty area
 * of a screen rather than a strip inside existing content.
 */
export const CircleLoader: React.FC<CircleLoaderProps> = ({
  color = COLORS.primary,
  dotSize = 6,
  size = 40,
  style,
}) => {
  const radius = size / 2 - dotSize / 2;
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <CircleDot
          key={i}
          // Dot 0 leads; each one behind it trails by a step, so the arc reads
          // brightest at the head and fades out behind.
          startPhase={0.25 - i * PHASE_STEP}
          color={color}
          size={dotSize}
          radius={radius}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Each dot rides its own full-size arm pivoting about the ring centre.
  arm: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
