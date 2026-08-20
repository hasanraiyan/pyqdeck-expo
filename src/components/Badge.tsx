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

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10.5,
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
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marksText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
