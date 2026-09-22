import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Linking,
  ViewStyle,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { COLORS } from '../theme/colors';
import { renderMarkdownMath } from '../utils/mathRenderer';

export interface MathViewProps {
  /** Raw Markdown containing LaTeX math ($...$, $$...$$, \(...\), \[...\]) */
  content?: string | null;
  /** Optional pre-rendered HTML from the server (falls back to client-side KaTeX rendering) */
  html?: string | null;
  fontSize?: number;
  textColor?: string;
  style?: ViewStyle;
}

const MEASURE_JS = `
(function () {
  function report() {
    var height = document.documentElement.scrollHeight || document.body.scrollHeight;
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: height }));
    }
  }
  report();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(report);
  }
  if (window.ResizeObserver) {
    new ResizeObserver(report).observe(document.body);
  }
  window.addEventListener('load', report);
  setTimeout(report, 100);
  setTimeout(report, 400);
})();
true;
`;

const buildHtmlDocument = (bodyHtml: string, textColor: string, fontSize: number): string => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <!-- Local KaTeX stylesheet bundled in assets/katex -->
  <link rel="stylesheet" href="katex.min.css">
  <style>
    /* CDN font fallback for environments where local android_asset is unavailable */
    @font-face {
      font-family: 'KaTeX_Main';
      src: url('fonts/KaTeX_Main-Regular.woff2') format('woff2'),
           url('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Main-Regular.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'KaTeX_Math';
      src: url('fonts/KaTeX_Math-Italic.woff2') format('woff2'),
           url('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/KaTeX_Math-Italic.woff2') format('woff2');
      font-weight: normal;
      font-style: italic;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
    }
    body {
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.55;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      -webkit-font-smoothing: antialiased;
    }
    p { margin: 0 0 0.75em; }
    p:last-child { margin-bottom: 0; }
    h1, h2, h3, h4 {
      font-family: Georgia, Cambria, "Times New Roman", Times, serif;
      margin: 1em 0 0.4em;
      line-height: 1.25;
      color: ${COLORS.text};
    }
    h1 { font-size: 1.35em; }
    h2 { font-size: 1.2em; }
    h3 { font-size: 1.1em; }
    strong { color: ${COLORS.text}; font-weight: 700; }
    a { color: ${COLORS.primary}; text-decoration: underline; }
    ul, ol { padding-left: 1.4em; margin: 0.4em 0 0.8em; }
    li { margin: 0.25em 0; }
    code {
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: ${COLORS.cardSecondary};
      padding: 0.15em 0.35em;
      border-radius: 4px;
    }
    pre {
      background: ${COLORS.cardSecondary};
      padding: 0.8em 1em;
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      margin: 0.6em 0;
      padding: 0.2em 0 0.2em 0.9em;
      border-left: 3px solid ${COLORS.border};
      color: ${COLORS.textMuted};
    }
    table {
      border-collapse: collapse;
      margin: 0.6em 0;
      width: 100%;
      display: block;
      overflow-x: auto;
    }
    th, td {
      border: 1px solid ${COLORS.border};
      padding: 0.4em 0.6em;
      text-align: left;
    }
    th { background: ${COLORS.cardSecondary}; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    hr {
      border: 0;
      border-top: 1px dashed ${COLORS.border};
      margin: 1em 0;
    }
    /* KaTeX math styling */
    .katex {
      font-size: 1.05em;
      text-rendering: auto;
    }
    .katex-display {
      margin: 0.75em 0;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.25em 0;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>
`;

export const MathView: React.FC<MathViewProps> = React.memo(
  ({
    content,
    html,
    fontSize = 16,
    textColor = COLORS.text,
    style,
  }) => {
    const [height, setHeight] = useState<number>(36);

    // If pre-rendered HTML from server is provided, use it;
    // otherwise render client-side from raw markdown + LaTeX.
    const bodyHtml = useMemo(() => {
      if (html && html.trim().length > 0) {
        return html;
      }
      return renderMarkdownMath(content || '');
    }, [html, content]);

    const fullHtml = useMemo(
      () => buildHtmlDocument(bodyHtml, textColor, fontSize),
      [bodyHtml, textColor, fontSize]
    );

    const onMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'height' && typeof data.height === 'number') {
          const newHeight = Math.max(Math.ceil(data.height) + 4, 24);
          setHeight(newHeight);
        }
      } catch {
        // Ignore non-json messages
      }
    }, []);

    const handleOpenLink = useCallback(async (url: string) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) return;
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Linking.openURL(url).catch(() => {});
      }
    }, []);

    const baseUrl = Platform.select({
      android: 'file:///android_asset/katex/',
      default: undefined,
    });

    if (!bodyHtml || bodyHtml.trim().length === 0) {
      return null;
    }

    return (
      <View style={[styles.container, { height }, style]}>
        <WebView
          originWhitelist={['*']}
          source={{ html: fullHtml, baseUrl }}
          style={styles.webview}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          javaScriptEnabled={true}
          injectedJavaScript={MEASURE_JS}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(request) => {
            // Intercept external links and open via system browser
            if (
              request.url &&
              (request.url.startsWith('http://') || request.url.startsWith('https://'))
            ) {
              handleOpenLink(request.url);
              return false;
            }
            return true;
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
