import React from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '../utils/responsive';

type Variant = 'wide' | 'read';

/**
 * Frame style for a ScrollView's contentContainerStyle (or any View) when the
 * screen already pads its own children: caps width and centres, no gutter.
 * Pass `gutter: true` to add the breakpoint gutter as ScreenContainer does.
 */
export function useContainerStyle(variant: Variant = 'wide', gutter = true): ViewStyle {
  const { wideMaxWidth, readMaxWidth, hPadding } = useResponsive();
  const pad = gutter ? hPadding : 0;
  const max = (variant === 'wide' ? wideMaxWidth : readMaxWidth) + pad * 2;
  // No paddingHorizontal when there is no gutter, so it can't override a
  // screen's own padding (e.g. a ScrollView `scroll` style).
  return gutter
    ? { width: '100%', maxWidth: max, alignSelf: 'center', paddingHorizontal: pad }
    : { width: '100%', maxWidth: max, alignSelf: 'center' };
}

interface Props {
  /** 'wide' for index and grid screens, 'read' for prose and forms (SRS section 4). */
  variant?: Variant;
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
  const frame = useContainerStyle(variant, gutter);
  return (
    <View onLayout={onLayout} style={[frame, style]}>
      {children}
    </View>
  );
}
