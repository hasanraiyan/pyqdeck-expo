import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from './WebViewCompat';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

export interface MermaidViewerProps {
  visible: boolean;
  code: string;
  svg: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  visible,
  code,
  svg,
  title,
  subtitle,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pure HTML rendering the pre-rendered SVG with pinch-to-zoom and pan enabled
  // Small inline gesture script only (no external JS) for instant opening
  const htmlContent = React.useMemo(() => {
    if (!visible || !svg) return '';

    // Strip scripts / inline handlers: JS is enabled only for our own gesture code
    const safeSvg = svg
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      background: ${COLORS.background};
      overflow: hidden;
      touch-action: none;
      -webkit-user-select: none; user-select: none;
    }
    #stage {
      position: absolute; top: 0; left: 0;
      width: 100vw; padding: 16px;
      transform-origin: 0 0;
    }
    /* While fingers are down the stage is promoted to its own layer, so pinch/pan
       only moves a cached bitmap (smooth). Expensive SVG filters (hand-drawn
       wobble) are switched off for that time. On release the layer is dropped so
       Chromium re-rasterizes crisply at the final scale, filters back on. */
    #stage.moving { will-change: transform; }
    #stage.moving [filter] { filter: none !important; }
    #zoomctl {
      position: fixed; right: 12px; bottom: 16px; z-index: 10;
      display: flex; flex-direction: column; gap: 8px;
    }
    #zoomctl button {
      width: 44px; height: 44px; border-radius: 22px; border: 1px solid ${COLORS.border};
      background: ${COLORS.card}; color: ${COLORS.text};
      font: 600 22px/1 sans-serif; padding: 0; opacity: 0.92;
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    }
    #zoomctl button:active { opacity: 1; background: ${COLORS.border}; }
    svg { text-rendering: geometricPrecision; shape-rendering: geometricPrecision; }
    #stage svg {
      display: block;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
    }
  </style>
</head>
<body>
  <div id="stage">${safeSvg}</div>
  <div id="zoomctl">
    <button type="button" id="zin" aria-label="Zoom in">+</button>
    <button type="button" id="zout" aria-label="Zoom out">&minus;</button>
    <button type="button" id="zreset" aria-label="Reset zoom" style="font-size:15px">1x</button>
  </div>
  <script>
  (function () {
    var stage = document.getElementById('stage');
    var MIN = 1, MAX = 6;
    var s = 1, x = 0, y = 0;
    function vw() { return window.innerWidth; }
    function vh() { return window.innerHeight; }
    function clamp() {
      var w = stage.offsetWidth * s, h = stage.offsetHeight * s;
      x = w <= vw() ? (vw() - w) / 2 : Math.min(0, Math.max(vw() - w, x));
      y = h <= vh() ? (vh() - h) / 2 : Math.min(0, Math.max(vh() - h, y));
    }
    var settle = null;
    function moving() {
      clearTimeout(settle);
      stage.classList.add('moving');
    }
    function settleSoon() {
      clearTimeout(settle);
      settle = setTimeout(function () { stage.classList.remove('moving'); }, 120);
    }
    function apply() {
      clamp();
      stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    }
    function zoomAt(cx, cy, ns) {
      ns = Math.min(MAX, Math.max(MIN, ns));
      x = cx - (cx - x) * (ns / s);
      y = cy - (cy - y) * (ns / s);
      s = ns;
      apply();
    }
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    var last = null, startDist = 0, startScale = 1, lastTap = 0;
    document.addEventListener('touchstart', function (e) {
      moving();
      if (e.touches.length === 2) {
        startDist = dist(e.touches); startScale = s; last = null;
      } else if (e.touches.length === 1) {
        last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        var now = Date.now();
        if (now - lastTap < 300) {
          if (s > 1.01) { s = 1; x = 0; y = 0; apply(); }
          else zoomAt(last.x, last.y, 2.5);
          lastTap = 0;
        } else lastTap = now;
      }
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      e.preventDefault(); // also keeps taps on the zoom buttons from scrolling
      if (e.touches.length === 2) {
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(cx, cy, startScale * dist(e.touches) / startDist);
      } else if (e.touches.length === 1 && last) {
        x += e.touches[0].clientX - last.x;
        y += e.touches[0].clientY - last.y;
        last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        apply();
      }
    }, { passive: false });
    document.addEventListener('touchend', function (e) {
      last = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      if (e.touches.length === 0) settleSoon();
    });
    // Manual zoom buttons: step around the screen centre. Touches on them must not
    // reach the document gesture handlers (pan / double-tap zoom).
    function step(f) {
      moving();
      zoomAt(vw() / 2, vh() / 2, s * f);
      settleSoon();
    }
    function bind(id, fn) {
      var el = document.getElementById(id);
      ['touchstart', 'touchmove', 'touchend'].forEach(function (t) {
        el.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
      });
      el.addEventListener('click', fn);
    }
    bind('zin', function () { step(1.5); });
    bind('zout', function () { step(1 / 1.5); });
    bind('zreset', function () { moving(); s = 1; x = 0; y = 0; apply(); settleSoon(); });
    window.addEventListener('load', apply);
    window.addEventListener('resize', apply);
    apply();
  })();
  </script>
</body>
</html>`;
  }, [visible, svg]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Top safe-area header with consistent styling */}
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={onClose}
              accessibilityLabel="Close diagram viewer"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="arrow-left" size={20} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title || 'DIAGRAM VIEWER'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle || 'Pinch, double-tap or use +/− to zoom'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleCopy}
              accessibilityLabel="Copy diagram source"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={18}
                color={copied ? COLORS.secondary : COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fullscreen WebView area with bottom inset */}
        <View style={[styles.webViewWrapper, { paddingBottom: insets.bottom }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={styles.webView}
            scrollEnabled={true}
            scalesPageToFit={false}
            javaScriptEnabled={true}
            domStorageEnabled={false}
            nestedScrollEnabled={true}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
