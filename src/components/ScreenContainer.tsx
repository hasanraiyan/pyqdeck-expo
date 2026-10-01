import React from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '../utils/responsive';

interface Props {
  /** 'wide' for index and grid screens, 'read' for prose and forms (SRS section 4). */
  variant?: 'wide' | 'read';
  /** Apply the breakpoint gutter on both sides. Default true. */
  gutter?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * The one place a screen's page gutter, max width and centring are decided
 * (FR-L1). Put it inside a ScrollView or screen body instead of hand-rolling
 * `maxWidth` + `alignSelf: 'center'` + `paddingHorizontal`.
 *
 * Content width is capped at the variant's max, with the gutter outside it
 * (box-sizing is border-box), matching what screens did by hand before.
 */
export function ScreenContainer({ variant = 'wide', gutter = true, onLayout, style, children }: Props) {
  const { wideMaxWidth, readMaxWidth, hPadding } = useResponsive();
  const pad = gutter ? hPadding : 0;
  const max = (variant === 'wide' ? wideMaxWidth : readMaxWidth) + pad * 2;
  return (
    <View
      onLayout={onLayout}
      style={[{ width: '100%', maxWidth: max, alignSelf: 'center', paddingHorizontal: pad }, style]}
    >
      {children}
    </View>
  );
}
