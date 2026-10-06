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
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

interface MermaidViewerProps {
  visible: boolean;
  code: string;
  svg: string;
  onClose: () => void;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  visible,
  code,
  svg,
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
  // Zero external JavaScript loaded here for instantaneous modal opening
  const htmlContent = React.useMemo(() => {
    if (!visible || !svg) return '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${COLORS.background};
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #wrapper {
      padding: 24px;
      min-width: 100%;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      max-width: none;
      height: auto;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <div id="container">${svg}</div>
  </div>
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
                DIAGRAM VIEWER
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Pinch or double-tap to zoom
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
            javaScriptEnabled={false}
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
