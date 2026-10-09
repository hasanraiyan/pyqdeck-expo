import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { WebView, WebViewMessageEvent } from './WebViewCompat';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { CircleLoader } from './CircleLoader';
import { NativeCodeBlock } from './NativeCodeBlock';
import { MermaidViewer } from './MermaidViewer';
import {
  renderMermaid,
  getCachedDiagram,
  RenderResult,
} from '../services/mermaidRenderer';

interface MermaidBlockProps {
  code: string;
}

// Safety ceiling only. The inline view can't scroll and clips overflow, so a low
// cap cuts off tall diagrams; tap-to-zoom still opens the full viewer.
const MAX_INLINE_HEIGHT = 4000;

/**
 * Calculate the exact pixel height needed to render the diagram tightly,
 * avoiding any artificial whitespace or "fake space" above/below the diagram.
 */
function calculateFittedHeight(
  intrinsicWidth: number,
  intrinsicHeight: number,
  containerWidth: number
): number {
  if (!intrinsicHeight || intrinsicHeight <= 0) return 90;

  // Available width inside the card (accounting for horizontal padding)
  const availW = containerWidth > 30 ? containerWidth - 16 : 340;

  if (intrinsicWidth && intrinsicWidth > 0) {
    if (intrinsicWidth > availW) {
      const scale = availW / intrinsicWidth;
      const scaledHeight = Math.ceil(intrinsicHeight * scale);
      return Math.min(MAX_INLINE_HEIGHT, Math.max(48, scaledHeight + 14));
    }
    return Math.min(MAX_INLINE_HEIGHT, Math.max(48, Math.ceil(intrinsicHeight) + 14));
  }

  return Math.min(MAX_INLINE_HEIGHT, Math.max(48, Math.ceil(intrinsicHeight) + 14));
}

// How often (ms) a mounted block checks whether it is still near the viewport.
const VISIBILITY_POLL_MS = 500;

/**
 * Each inline diagram is a full WebView, which is expensive. Only keep the
 * WebView mounted while the block is within about one screen of the viewport;
 * otherwise a same-height placeholder holds the layout.
 */
function useNearViewport(ref: React.RefObject<View | null>): boolean {
  const { height: screenH } = useWindowDimensions();
  const [near, setNear] = useState(true);

  useEffect(() => {
    const check = () => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        if (h === 0 && y === 0) return; // not laid out yet
        setNear(y + h > -screenH && y < screenH * 2);
      });
    };
    check();
    const id = setInterval(check, VISIBILITY_POLL_MS);
    return () => clearInterval(id);
  }, [ref, screenH]);

  return near;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = React.memo(({ code }) => {
  const cardRef = useRef<View>(null);
  const near = useNearViewport(cardRef);
  const cached = useMemo(() => getCachedDiagram(code), [code]);

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const svgDimensions = useRef<{ width: number; height: number } | null>(
    cached ? { width: cached.width, height: cached.height } : null
  );

  const [svg, setSvg] = useState<string | null>(cached ? cached.svg : null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [diagramHeight, setDiagramHeight] = useState<number>(() => {
    if (cached && cached.height) {
      return calculateFittedHeight(cached.width, cached.height, 0);
    }
    return 90;
  });
  const [viewerOpen, setViewerOpen] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
      if (svgDimensions.current) {
        const { width: iw, height: ih } = svgDimensions.current;
        setDiagramHeight(calculateFittedHeight(iw, ih, w));
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    if (cached) {
      setSvg(cached.svg);
      setLoading(false);
      svgDimensions.current = { width: cached.width, height: cached.height };
      setDiagramHeight(calculateFittedHeight(cached.width, cached.height, containerWidth));
      return;
    }

    setLoading(true);
    setRenderError(null);

    renderMermaid(code)
      .then((res: RenderResult) => {
        if (mounted) {
          setSvg(res.svg);
          setLoading(false);
          svgDimensions.current = { width: res.width, height: res.height };
          setDiagramHeight(calculateFittedHeight(res.width, res.height, containerWidth));
        }
      })
      .catch((err: any) => {
        if (mounted) {
          console.warn('[Mermaid Render Failed]', err?.message || err);
          setRenderError(err?.message || 'Syntax error in Mermaid diagram');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [code, cached, containerWidth]);

  const handleOpenViewer = () => {
    if (!svg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerOpen(true);
  };

  const handleInlineMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'size' && typeof data.height === 'number' && data.height > 0) {
        // Precise rendered height from the browser engine + tight padding
        const fitted = Math.min(MAX_INLINE_HEIGHT, Math.max(48, Math.ceil(data.height) + 14));
        setDiagramHeight(fitted);
      }
    } catch {
      // Ignore invalid JSON
    }
  };

  // Ultra-lightweight HTML shell containing ONLY the pre-rendered SVG
  // Fits diagram tightly without extra empty space above or below
  const inlineHtml = useMemo(() => {
    if (!svg) return '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, Roboto, sans-serif;
    }
    #wrap {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 6px 8px;
    }
    svg {
      display: block;
      max-width: 100% !important;
      height: auto !important;
    }
  </style>
</head>
<body>
  <div id="wrap">${svg}</div>
  <script>
    function reportSize() {
      var svg = document.querySelector('svg');
      var wrap = document.getElementById('wrap');
      var h = 0;
      if (svg) {
        var rect = svg.getBoundingClientRect();
        h = Math.ceil(rect.height);
      } else if (wrap) {
        h = Math.ceil(wrap.getBoundingClientRect().height);
      }
      if (h > 0 && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'size', height: h }));
      }
    }
    window.addEventListener('load', reportSize);
    setTimeout(reportSize, 150);
  </script>
</body>
</html>`;
  }, [svg]);

  // Gracefully fallback to code block on syntax errors or render failures
  if (renderError) {
    return (
      <View style={styles.fallbackWrap}>
        <View style={styles.fallbackNotice}>
          <Feather name="info" size={13} color={COLORS.primary} />
          <Text style={styles.fallbackNoticeText}>
            {renderError}
          </Text>
        </View>
        <NativeCodeBlock code={code} language="mermaid" />
      </View>
    );
  }

  return (
    <View ref={cardRef} style={styles.card} onLayout={onLayout}>
      {/* Diagram container - clean, headerless figure. Tapping opens fullscreen zoom */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleOpenViewer}
        disabled={loading || !svg}
        style={[styles.diagramTouchWrap, { height: diagramHeight }]}
        accessibilityLabel="Diagram figure. Tap to zoom."
        accessibilityRole="image"
      >
        {loading && (
          <View style={styles.loaderWrap}>
            <CircleLoader color={COLORS.primary} dotSize={5} size={28} />
            <Text style={styles.loadingText}>Rendering diagram…</Text>
          </View>
        )}

        {svg && near && (
          <WebView
            originWhitelist={['*']}
            source={{ html: inlineHtml }}
            style={[styles.webView, loading && { opacity: 0 }]}
            scrollEnabled={false}
            scalesPageToFit={false}
            javaScriptEnabled={true}
            domStorageEnabled={false}
            onMessage={handleInlineMessage}
            pointerEvents="none"
          />
        )}
      </TouchableOpacity>

      {/* Fullscreen zoom & pan modal (includes Copy & Close in its top bar) */}
      {svg && (
        <MermaidViewer
          visible={viewerOpen}
          code={code}
          svg={svg}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  diagramTouchWrap: {
    width: '100%',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 2,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fallbackWrap: {
    marginVertical: 8,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  fallbackNoticeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    color: COLORS.primary,
  },
});
