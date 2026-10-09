import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from './WebViewCompat';
import { getMermaidJs } from '../utils/mermaidAsset';
import {
  registerMermaidWorker,
  handleWorkerMessage,
  getWorkerHtml,
  isWorkerRequested,
  subscribeWorkerRequested,
} from '../services/mermaidRenderer';

export const MermaidWorker: React.FC = () => {
  const [mermaidJs, setMermaidJs] = useState<string | null>(null);
  const [needed, setNeeded] = useState<boolean>(isWorkerRequested());
  const webViewRef = useRef<WebView>(null);

  // Stay idle until the first diagram asks for a render.
  useEffect(() => {
    if (needed) return;
    // A render may have been requested between first render and this effect.
    if (isWorkerRequested()) {
      setNeeded(true);
      return;
    }
    return subscribeWorkerRequested(() => setNeeded(true));
  }, [needed]);

  useEffect(() => {
    if (!needed) return;
    let mounted = true;
    getMermaidJs()
      .then((js) => {
        if (mounted) {
          setMermaidJs(js);
        }
      })
      .catch((err) => {
        console.warn('[MermaidWorker] Failed to load mermaid asset:', err);
      });

    return () => {
      mounted = false;
    };
  }, [needed]);

  useEffect(() => {
    // Register the callback to inject javascript into this worker WebView
    const unregister = registerMermaidWorker((jsToInject) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(jsToInject);
      }
    });

    return () => {
      unregister();
    };
  }, []);

  const workerHtml = useMemo(() => {
    if (!mermaidJs) return '';
    return getWorkerHtml(mermaidJs);
  }, [mermaidJs]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      handleWorkerMessage(data);
    } catch (e) {
      console.warn('[MermaidWorker] Invalid worker message:', e);
    }
  };

  if (!mermaidJs) {
    return null;
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none" aria-hidden={true}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: workerHtml }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        scalesPageToFit={false}
        onMessage={onMessage}
        style={styles.workerWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 800,
    height: 600,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  workerWebView: {
    width: 800,
    height: 600,
    backgroundColor: 'transparent',
  },
});
