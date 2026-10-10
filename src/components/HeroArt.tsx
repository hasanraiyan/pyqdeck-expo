import React from 'react';
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';
import { COLORS } from '../theme/colors';

/**
 * The home hero's illustration: two exam papers fanned out, a graded tick in
 * the grading-pen red, a teal stamp, and a pencil. Drawn from the app palette
 * so it follows the "exam paper" look, and scales to its container's width.
 */
export const HeroArt = ({
  compact = false,
}: {
  /** Crops the scattered dots and baseline so the papers fill a narrow slot. */
  compact?: boolean;
}) => {
  // Height comes from the viewBox's aspect ratio, not a fixed number: a fixed
  // height taller than the width allows leaves empty bands above and below.
  const box = compact ? { x: 18, y: 2, w: 262, h: 154 } : { x: 0, y: 0, w: 320, h: 160 };
  return (
  <Svg
    style={{ width: '100%', aspectRatio: box.w / box.h }}
    viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
    preserveAspectRatio="xMidYMid meet"
  >
    {/* Faint ruled backdrop */}
    <Line x1="8" y1="152" x2="312" y2="152" stroke={COLORS.borderDashed} strokeWidth="1.5" strokeDasharray="4 5" />
    <Circle cx="40" cy="30" r="3" fill={COLORS.primaryBorder} />
    <Circle cx="288" cy="22" r="4" fill={COLORS.secondaryLight} />
    <Circle cx="300" cy="96" r="2.5" fill={COLORS.primaryBorder} />

    {/* Back paper */}
    <G rotation="-8" origin="119, 81">
      <Rect x="78" y="14" width="82" height="134" rx="6" fill={COLORS.cardSecondary} stroke={COLORS.border} strokeWidth="1.5" />
      <Path d="M90 38 H146 M90 52 H138 M90 66 H146 M90 80 H134 M90 94 H146" stroke={COLORS.borderDashed} strokeWidth="3" strokeLinecap="round" />
    </G>

    {/* Front paper */}
    <G rotation="5" origin="167, 78">
      <Rect x="124" y="8" width="86" height="140" rx="6" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1.5" />
      <Rect x="136" y="24" width="30" height="7" rx="3.5" fill={COLORS.text} />
      <Path d="M136 52 H196 M136 66 H190 M136 80 H196 M136 94 H174 M136 108 H192 M136 122 H168" stroke={COLORS.border} strokeWidth="3.5" strokeLinecap="round" />
      {/* Graded tick */}
      <Circle cx="190" cy="30" r="11" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
      <Path d="M184.5 30.5 L188.5 34.5 L196 26" stroke={COLORS.primary} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>

    {/* Teal exam stamp - nudged left so it overlaps the front paper's right edge */}
    <G rotation="-14" origin="200, 112">
      <Circle cx="200" cy="112" r="24" fill="none" stroke={COLORS.secondary} strokeWidth="2.5" />
      <Circle cx="200" cy="112" r="18" fill="none" stroke={COLORS.secondary} strokeWidth="1.2" strokeDasharray="3 3" />
      <Path d="M190 112 L197 119 L211 105" stroke={COLORS.secondary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>

    {/* Pencil */}
    <G rotation="-38" origin="60, 114">
      <Rect x="26" y="108" width="64" height="12" rx="2" fill={COLORS.primary} />
      <Rect x="26" y="108" width="12" height="12" rx="2" fill={COLORS.textSubtle} />
      <Path d="M90 108 L108 114 L90 120 Z" fill={COLORS.accent} stroke={COLORS.borderDashed} strokeWidth="1" strokeLinejoin="round" />
      <Path d="M101 112.2 L108 114 L101 115.8 Z" fill={COLORS.text} />
    </G>
  </Svg>
  );
};
