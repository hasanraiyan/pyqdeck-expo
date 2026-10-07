import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS } from '../theme/colors';
import { extractSvgDimensions, extractSvgTitle } from '../utils/svgParser';
import { MermaidViewer } from './MermaidViewer';
import { ContentErrorBoundary } from './ContentErrorBoundary';

export interface SvgDiagramBlockProps {
  xml: string;
  title?: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
}

export const SvgDiagramBlock: React.FC<SvgDiagramBlockProps> = React.memo(
  ({ xml, title, aspectRatio: explicitRatio, style }) => {
    const [viewerOpen, setViewerOpen] = useState(false);

    const { computedRatio, displayTitle } = useMemo(() => {
      const { aspectRatio } = extractSvgDimensions(xml);
      const parsedTitle = extractSvgTitle(xml);
      return {
        computedRatio: explicitRatio || aspectRatio || 16 / 9,
        displayTitle: title || parsedTitle || 'DIAGRAM VIEWER',
      };
    }, [xml, title, explicitRatio]);

    const handleOpenViewer = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setViewerOpen(true);
    };

    return (
      <View style={[styles.card, style]}>
        {/* Clean headerless diagram figure. Tapping opens fullscreen zoom viewer */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handleOpenViewer}
          style={styles.canvasTouchWrap}
          accessibilityLabel={`${displayTitle}. Tap to zoom.`}
          accessibilityRole="image"
        >
          <View style={[styles.canvas, { aspectRatio: computedRatio }]}>
            <ContentErrorBoundary fallbackText={xml}>
              <SvgXml xml={xml} width="100%" height="100%" />
            </ContentErrorBoundary>
          </View>
        </TouchableOpacity>

        {/* Fullscreen Interactive Zoom/Pan Modal */}
        {viewerOpen && (
          <MermaidViewer
            visible={viewerOpen}
            code={xml}
            svg={xml}
            title={displayTitle}
            subtitle="Pinch or double-tap to zoom"
            onClose={() => setViewerOpen(false)}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    marginVertical: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  canvasTouchWrap: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  canvas: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
