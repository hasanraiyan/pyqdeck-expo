import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { COLORS } from '../theme/colors';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SolutionSkeleton: React.FC = () => {
  return (
    <View style={{ paddingTop: 8, gap: 10 }}>
      <Skeleton width="92%" height={15} borderRadius={3} />
      <Skeleton width="80%" height={15} borderRadius={3} />
      <Skeleton width="88%" height={15} borderRadius={3} />
      <Skeleton width="65%" height={15} borderRadius={3} />
      <View style={{ marginTop: 6, gap: 6 }}>
        <Skeleton width="100%" height={40} borderRadius={4} />
      </View>
    </View>
  );
};

export const QuestionSkeleton: React.FC = () => {
  return (
    <View style={styles.questionRowSkeleton}>
      <View style={styles.questionRowLeft}>
        <Skeleton width="75%" height={16} borderRadius={3} />
      </View>
      <View style={styles.questionRowRight}>
        <Skeleton width={38} height={18} borderRadius={3} />
        <Skeleton width={32} height={18} borderRadius={3} />
        <Skeleton width={14} height={14} borderRadius={3} />
      </View>
    </View>
  );
};

export const SubjectCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={14} />
      <View style={[styles.row, { marginTop: 12 }]}>
        <Skeleton width={80} height={20} borderRadius={4} />
        <Skeleton width={50} height={20} borderRadius={12} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
  cardSkeleton: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  questionRowLeft: {
    flex: 1,
  },
  questionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
