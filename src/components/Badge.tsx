import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '../theme/colors';

interface BadgeProps {
  label: string | number;
  variant?: 'default' | 'secondary' | 'outline' | 'success';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default' }) => {
  const textStyleKey = `${variant}Text` as keyof typeof styles;
  return (
    <View style={[styles.badge, styles[variant]]}>
      <Text style={[styles.text, styles[textStyleKey]]}>{label}</Text>
    </View>
  );
};

// Signature element: question marks inside hand-drawn grading circle
export const MarksBadge: React.FC<{ marks: number | null | undefined }> = ({ marks }) => {
  if (marks === null || marks === undefined) return null;
  return (
    <View style={styles.marksContainer}>
      <Svg
        viewBox="0 0 64 34"
        style={StyleSheet.absoluteFill}
        fill="none"
      >
        <Path
          d="M7 17C5 9 15 4 32 4C50 4 58 9 57 17C56 26 47 30 32 30C15 30 8 25 7 17Z"
          stroke={COLORS.primary}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.marksText}>{marks}m</Text>
    </View>
  );
};

// Signature element: Hand-drawn / stamped Ask AI action badge button
export const AskAiBadge: React.FC<{ onPress?: () => void; label?: string }> = ({
  onPress,
  label = 'Ask AI',
}) => {
  return (
    <View style={styles.askAiContainer}>
      <Svg
        viewBox="0 0 84 34"
        style={StyleSheet.absoluteFill}
        fill="none"
      >
        <Path
          d="M6 17C4 8 18 4 42 4C66 4 80 8 78 17C76 26 66 30 42 30C18 30 8 26 6 17Z"
          stroke={COLORS.primary}
          strokeWidth="1.6"
          strokeDasharray="2,2"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.askAiInner}>
        <Text style={styles.askAiSparkle}>✦</Text>
        <Text style={styles.askAiText}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: FONTS.mono,
  },
  default: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.border,
  },
  defaultText: {
    color: COLORS.text,
  },
  secondary: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.border,
  },
  secondaryText: {
    color: COLORS.textMuted,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  outlineText: {
    color: COLORS.textSubtle,
  },
  success: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  successText: {
    color: COLORS.secondary,
  },
  marksContainer: {
    width: 44,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marksText: {
    fontSize: 12,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    color: COLORS.primary,
    lineHeight: 16,
  },
  askAiContainer: {
    width: 68,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 11,
  },
  askAiInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  askAiSparkle: {
    fontSize: 9,
    color: COLORS.primary,
    fontWeight: '700',
  },
  askAiText: {
    fontSize: 10.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
});
