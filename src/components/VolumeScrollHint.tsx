import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

const VISIBLE_MS = 2200;

interface VolumeScrollHintProps {
  visible: boolean;
  onHide: () => void;
  bottomOffset: number;
}

// One-time toast shown the first time volume-button scrolling fires, so the
// (otherwise silent) behavior change doesn't feel like the hardware misbehaving.
export const VolumeScrollHint: React.FC<VolumeScrollHintProps> = ({
  visible,
  onHide,
  bottomOffset,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onHide());
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Feather name="volume-2" size={13} color={COLORS.card} />
      <Text style={styles.text}>Volume buttons scroll this page</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.text,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.card,
    letterSpacing: 0.2,
  },
});
