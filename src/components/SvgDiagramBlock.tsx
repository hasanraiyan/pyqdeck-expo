import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Animated,
  Easing,
  PixelRatio,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS } from '../theme/colors';
import { extractSvgDimensions, extractSvgTitle, sanitizeSvgForNative } from '../utils/svgParser';
import { MermaidViewer } from './MermaidViewer';
import { DevDiagramTag } from './DevDiagramTag';
import { ContentErrorBoundary } from './ContentErrorBoundary';
import { enqueueHeavy } from '../utils/heavyQueue';
import { loadNoteFonts } from '../utils/noteFonts';
import { DiagramPlaceholder } from './DiagramPlaceholder';

export interface SvgDiagramBlockProps {
  xml: string;
  title?: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
}

export const SvgDiagramBlock: React.FC<SvgDiagramBlockProps> = React.memo(
  ({ xml, title, aspectRatio: explicitRatio, style }) => {
    const [viewerOpen, setViewerOpen] = useState(false);
    // Drawing a big SVG blocks the JS thread, so it waits its turn in the heavy
    // queue (after the text, one diagram at a time) behind a same-size placeholder.
    const [drawn, setDrawn] = useState(false);
    // 0 = placeholder only, 1 = diagram fully faded in (runs on the native side,
    // so it keeps animating even while the JS thread is busy drawing).
    const reveal = useRef(new Animated.Value(0)).current;
    const [placeholderGone, setPlaceholderGone] = useState(false);

    useEffect(
      () =>
        enqueueHeavy(
          () =>
            // Wait for the diagram's handwritten fonts (usually already loaded)
            // so the text is drawn in them, not in a fallback.
            loadNoteFonts().then(
              () =>
                new Promise<void>((resolve) => {
                  setDrawn(true);
                  // The draw commits (and blocks) before this timer fires.
                  setTimeout(resolve, 16);
                })
            )
        ),
      []
    );

    const { computedRatio, displayTitle } = useMemo(() => {
      const { aspectRatio } = extractSvgDimensions(xml);
      const parsedTitle = extractSvgTitle(xml);
      return {
        computedRatio: explicitRatio || aspectRatio || 16 / 9,
        displayTitle: title || parsedTitle || 'DIAGRAM VIEWER',
      };
    }, [xml, title, explicitRatio]);

    const nativeXml = useMemo(() => sanitizeSvgForNative(xml), [xml]);

    // Sharing as a picture: the same native drawing the note shows (so the
    // handwriting fonts are right), drawn once more at ~3000 px wide on a white page.
    const [exporting, setExporting] = useState(false);
    const exportRef = useRef<any>(null);
    const exportLaidOut = useRef<(() => void) | null>(null);
    const exportXml = useMemo(
      () =>
        exporting
          ? nativeXml.replace(
              /(<svg\b[^>]*>)/i,
              '$1<rect x="-20000" y="-20000" width="40000" height="40000" fill="#FFFFFF"/>'
            )
          : '',
      [exporting, nativeXml]
    );
    const exportWidthDp = 3000 / PixelRatio.get();
    const exportPng = () =>
      new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          setExporting(false);
          reject(new Error('export timeout'));
        }, 20000);
        exportLaidOut.current = () => {
          // Give the native view a moment to draw its first frame.
          setTimeout(() => {
            const node = exportRef.current;
            if (!node?.toDataURL) {
              clearTimeout(timeout);
              setExporting(false);
              reject(new Error('no svg ref'));
              return;
            }
            node.toDataURL((b64: string) => {
              clearTimeout(timeout);
              setExporting(false);
              resolve(b64);
            });
          }, 250);
        };
        setExporting(true);
      });

    useEffect(() => {
      if (!drawn) return;
      Animated.timing(reveal, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setPlaceholderGone(true));
    }, [drawn, reveal]);

    const handleOpenViewer = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setViewerOpen(true);
    };

    return (
      <View style={[styles.card, style]}>
        <DevDiagramTag kind="svg" />
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
              {!placeholderGone && <DiagramPlaceholder fade={reveal} />}
              {drawn && (
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: reveal,
                      transform: [
                        { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                      ],
                    },
                  ]}
                >
                  <SvgXml xml={nativeXml} width="100%" height="100%" />
                </Animated.View>
              )}
            </ContentErrorBoundary>
          </View>
        </TouchableOpacity>

        {exporting && (
          <View
            pointerEvents="none"
            onLayout={() => {
              exportLaidOut.current?.();
              exportLaidOut.current = null;
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: exportWidthDp,
              height: exportWidthDp / computedRatio,
              opacity: 0,
            }}
          >
            {React.createElement(SvgXml as any, {
              ref: exportRef,
              xml: exportXml,
              width: '100%',
              height: '100%',
            })}
          </View>
        )}

        {/* Fullscreen Interactive Zoom/Pan Modal */}
        {viewerOpen && (
          <MermaidViewer
            visible={viewerOpen}
            code={xml}
            svg={xml}
            exportPng={exportPng}
            title={displayTitle}
            subtitle="Pinch, double-tap or use +/− to zoom"
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
  },
  canvas: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
