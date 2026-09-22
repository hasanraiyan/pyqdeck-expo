import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { texToSvg } from '../utils/nativeMathSvg';

export interface NativeMathViewProps {
  /** Raw LaTeX math expression (without delimiters) */
  math: string;
  /** Display mode (centered block equation) or inline mode */
  displayMode?: boolean;
  fontSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const NativeMathView: React.FC<NativeMathViewProps> = React.memo(
  ({
    math,
    displayMode = false,
    fontSize = 16,
    color = COLORS.text,
    style,
  }) => {
    const result = useMemo(() => {
      return texToSvg(math, {
        displayMode,
        fontSize,
        color,
      });
    }, [math, displayMode, fontSize, color]);

    if (!result || !result.xml) {
      return null;
    }

    if (displayMode) {
      return (
        <View style={[styles.displayWrapper, style]}>
          <View
            style={{
              width: result.width,
              height: result.height,
              maxWidth: '100%',
              aspectRatio: result.aspectRatio,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgXml
              xml={result.xml}
              width="100%"
              height="100%"
            />
          </View>
        </View>
      );
    }

    // Inline math with baseline adjustment
    return (
      <View
        style={[
          styles.inlineWrapper,
          {
            width: result.width,
            height: result.height,
            marginBottom: result.verticalAlign,
          },
          style,
        ]}
      >
        <SvgXml
          xml={result.xml}
          width={result.width}
          height={result.height}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  displayWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    overflow: 'visible',
  },
  inlineWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
