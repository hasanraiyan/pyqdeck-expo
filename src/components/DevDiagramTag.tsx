import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../theme/colors';

/**
 * Debug-only corner label showing how a diagram was rendered (Mermaid via the
 * WebView worker vs raw SVG via react-native-svg). Renders nothing outside dev.
 */
export const DevDiagramTag: React.FC<{ kind: 'mermaid' | 'svg' }> = ({ kind }) => {
  if (!__DEV__) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.tag, kind === 'mermaid' ? styles.mermaid : styles.svg]}
    >
      <Text style={styles.text}>{kind === 'mermaid' ? 'MERMAID' : 'SVG'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mermaid: { backgroundColor: '#7c3aed' },
  svg: { backgroundColor: '#059669' },
  text: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.6,
  },
});
