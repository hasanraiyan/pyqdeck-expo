import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../theme/colors';

interface CircleLoaderProps {
  color?: string;
  dotSize?: number;
  /** Outer diameter of the ring the dots sit on. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const DOT_COUNT = 6;

// Comet trail: the leading dot is solid, each one behind it dimmer. The ring
// itself spins, so the bright head sweeps around rather than the dots moving
// relative to each other.
const DOT_OPACITIES = [1, 0.78, 0.58, 0.42, 0.28, 0.16];

/**
 * Circular sibling of WaveLoader, for a loader that owns the whole empty area
 * of a screen (a full-page fetch) rather than a strip inside existing content.
 *
 * Unlike WaveLoader the dots are not staggered in: all six are on the ring
 * from the first frame, 60 degrees apart. A staggered entry works for the wave
 * because two dots sliding sideways still reads as "loading", but two dots on
 * a ring just reads as a pair of dots - on a fast fetch the loader would come
 * and go before the circle ever formed.
 */
export const CircleLoader: React.FC<CircleLoaderProps> = ({
  color = COLORS.primary,
  dotSize = 6,
  size = 40,
  style,
}) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Linear, or the rotation visibly stutters where the loop restarts.
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const radius = size / 2 - dotSize / 2;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
        {DOT_OPACITIES.slice(0, DOT_COUNT).map((opacity, i) => (
          <View
            key={i}
            style={[
              styles.arm,
              { transform: [{ rotate: `${(360 / DOT_COUNT) * i}deg` }] },
            ]}
          >
            <View
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                opacity,
                transform: [{ translateY: -radius }],
              }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: '100%',
    height: '100%',
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
