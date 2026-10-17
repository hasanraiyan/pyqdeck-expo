import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  Text,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADIUS } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const DISMISS_THRESHOLD = -SCREEN_WIDTH * 0.28;

interface Props {
  children: React.ReactNode;
  onDismiss: () => void;
  disabled?: boolean;
}

export const SwipeableDismissItem: React.FC<Props> = ({
  children,
  onDismiss,
  disabled = false,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Background only fades in when user actively swipes left
  // When translateX is 0 (tapping/pressing), opacity is completely 0 so red NEVER shows through
  const bgOpacity = translateX.interpolate({
    inputRange: [-35, -4, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled) return false;
        // Only capture horizontal swipes to the left that exceed vertical motion
        return (
          gestureState.dx < -10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx <= 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < DISMISS_THRESHOLD || gestureState.vx < -0.6) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onDismiss();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Background Revealed on Swipe - hidden unless dragging left */}
      <Animated.View style={[styles.background, { opacity: bgOpacity }]}>
        <View style={styles.actionContainer}>
          <Feather name="trash-2" size={19} color="#ffffff" />
          <Text style={styles.dismissText}>Dismiss</Text>
        </View>
      </Animated.View>

      {/* Foreground Content */}
      <Animated.View
        style={[
          styles.foreground,
          {
            opacity,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: RADIUS.md,
  },
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dismissText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  foreground: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
  },
});
