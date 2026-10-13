import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from './WebViewCompat';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { usePreventScreenCapture } from '../utils/screenCapture';
import { useAdminAccess } from '../admin/useAdminAccess';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

const SHARE_STEPS = [
  'Getting your diagram ready…',
  'Drawing it on a clean page…',
  'Making the text sharp…',
  'Saving the picture…',
  'Opening the share menu…',
];

export interface MermaidViewerProps {
  visible: boolean;
  code: string;
  svg: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  // When given, the share button gets its PNG (base64) from here instead of
  // drawing the SVG inside the web page. Used by note SVGs, which are drawn natively.
  exportPng?: () => Promise<string>;
}

// Blocks screenshots and screen recordings for as long as it is on screen.
const BlockScreenshots: React.FC = () => {
  usePreventScreenCapture('diagram-viewer');
  return null;
};

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  visible,
  code,
  svg,
  title,
  subtitle,
  onClose,
  exportPng,
}) => {
  const insets = useSafeAreaInsets();
  // Only admins can turn a diagram into a picture and share it.
  const { isAdmin } = useAdminAccess();
  const [copied, setCopied] = React.useState(false);
  // 0 = idle, 1..SHARE_STEPS.length = the step the export is on.
  const [shareStep, setShareStep] = React.useState(0);
  const sharing = shareStep > 0;
  const barFill = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(barFill, {
      toValue: shareStep / SHARE_STEPS.length,
      duration: shareStep === 0 ? 0 : 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shareStep, barFill]);
  const webRef = React.useRef<any>(null);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Asks the page to draw its diagram onto a canvas; the PNG comes back in onMessage.
  const handleShare = () => {
    if (sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareStep(1);
    if (exportPng) {
      setTimeout(() => setShareStep(0), 30000);
      setTimeout(async () => {
        try {
          setShareStep(2);
          const b64 = await exportPng();
          setShareStep(3);
          await saveAndShare(b64);
        } catch {
          setShareStep(0);
          Alert.alert('Could not share', 'This diagram could not be turned into an image.');
        }
      }, 60);
      return;
    }
    webRef.current?.injectJavaScript('window.__exportPng && window.__exportPng(); true;');
    // Never leave the button stuck if the page does not answer.
    setTimeout(() => setShareStep(0), 20000);
  };

  const handleMessage = async (event: WebViewMessageEvent) => {
    let msg: { type?: string; data?: string } | null = null;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg?.type === 'progress') {
      setShareStep((cur) => (cur > 0 ? Math.max(cur, msg?.data === 'encoding' ? 3 : 2) : cur));
      return;
    }
    if (msg?.type === 'png-error') {
      setShareStep(0);
      Alert.alert('Could not share', 'This diagram could not be turned into an image.');
      return;
    }
    if (msg?.type !== 'png' || !msg.data) return;
    await saveAndShare(msg.data);
  };

  const saveAndShare = async (base64: string) => {
    try {
      setShareStep(4);
      const safeName = (title || 'diagram').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'diagram';
      const uri = `${FileSystem.cacheDirectory}${safeName}-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      setShareStep(5);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title || 'Diagram' });
      } else {
        Alert.alert('Sharing not available', 'This device cannot share files.');
      }
    } catch {
      Alert.alert('Could not share', 'Something went wrong while sharing the image.');
    } finally {
      setShareStep(0);
    }
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
      e.preventDefault();
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
    window.__exportPng = function () {
      try {
        var svg = stage.querySelector('svg');
        var vb = svg.viewBox && svg.viewBox.baseVal;
        var w = vb && vb.width ? vb.width : parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width / s;
        var h = vb && vb.height ? vb.height : parseFloat(svg.getAttribute('height')) || svg.getBoundingClientRect().height / s;
        var clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        clone.style.cssText = '';
        // The diagram is vector, so scale it up to a large fixed size (long side
        // 4096 px, area capped) instead of its small on-screen size: sharp text.
        var k = Math.min(4096 / Math.max(w, h), Math.sqrt(16000000 / (w * h)));
        // Give the SVG itself the big size (with a viewBox so it scales), so the
        // browser draws it large from the start instead of stretching a small bitmap.
        if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        clone.setAttribute('width', Math.round(w * k));
        clone.setAttribute('height', Math.round(h * k));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        var img = new Image();
        img.onload = function () {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', data: 'drawing' }));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', data: 'encoding' }));
            var url = canvas.toDataURL('image/png');
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'png', data: url.split(',')[1] }));
          } catch (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'png-error' })); }
        };
        img.onerror = function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'png-error' })); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      } catch (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'png-error' })); }
    };
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
      <BlockScreenshots />
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
                {subtitle || 'Pinch or double-tap to zoom'}
              </Text>
            </View>

            {isAdmin && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleShare}
              accessibilityLabel="Share diagram as image"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name="share-2"
                size={18}
                color={sharing ? COLORS.border : COLORS.textMuted}
              />
            </TouchableOpacity>
            )}

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
          {sharing && (
            <View style={styles.progressCard} pointerEvents="none">
              <View style={styles.progressRow}>
                <View style={styles.progressIcon}>
                  <Feather name="image" size={18} color={COLORS.secondary} />
                </View>
                <View style={styles.progressTextWrap}>
                  <Text style={styles.progressTitle}>Creating your picture</Text>
                  <Text style={styles.progressText} numberOfLines={1}>
                    {SHARE_STEPS[shareStep - 1]}
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: barFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}
          <WebView
            ref={webRef}
            onMessage={handleMessage}
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
  progressCard: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 10,
    elevation: 8,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  progressTextWrap: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
