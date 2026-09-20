import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../theme/colors';

interface WaveLoaderProps {
  color?: string;
  dotSize?: number;
  style?: StyleProp<ViewStyle>;
}

// Delays matching l-1 (1.0s) through l-6 (0s) from the CSS animation
const DOT_DELAYS = [1000, 800, 600, 400, 200, 0];

interface WaveDotProps {
  delay: number;
  color: string;
  size: number;
}

const WaveDot: React.FC<WaveDotProps> = ({ delay, color, size }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: any = null;
    let animLoop: Animated.CompositeAnimation | null = null;

    const start = () => {
      animLoop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.bezier(0.03, 0.615, 0.995, 0.415),
          useNativeDriver: true,
        })
      );
      animLoop.start();
    };

    if (delay === 0) {
      start();
    } else {
      timer = setTimeout(start, delay);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (animLoop) animLoop.stop();
    };
  }, [anim, delay]);

  const translateX = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 1],
    outputRange: [-30, 0, 30, 30],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 1],
    outputRange: [0, 1, 0, 0],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateX }],
        },
      ]}
    />
  );
};

export const WaveLoader: React.FC<WaveLoaderProps> = ({
  color = COLORS.primary,
  dotSize = 5,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {DOT_DELAYS.map((delay, index) => (
        <WaveDot key={index} delay={delay} color={color} size={dotSize} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    height: 32,
  },
  dot: {
    marginHorizontal: 2.5,
  },
});
