import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

export interface WebViewMessageEvent {
  nativeEvent: { data: string };
}

export interface WebViewHandle {
  injectJavaScript: (js: string) => void;
}

interface WebViewProps {
  source: { html?: string; uri?: string; baseUrl?: string };
  style?: any;
  scrollEnabled?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onMessage?: (event: WebViewMessageEvent) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  // Native-only props (originWhitelist, javaScriptEnabled, bounces, ...) are
  // accepted and ignored so call sites stay identical across platforms.
  [key: string]: any;
}

let nextFrameId = 1;

// Defines window.ReactNativeWebView inside the frame so the existing HTML keeps
// calling postMessage, and evaluates scripts sent by injectJavaScript.
function bridgeScript(id: number): string {
  return `<script>(function(){var id=${id};window.ReactNativeWebView={postMessage:function(m){parent.postMessage({__rnwv:id,data:String(m)},'*');}};window.addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||d.__rnwv!==id||typeof d.__rnwvEval!=='string')return;try{(0,eval)(d.__rnwvEval);}catch(err){}});})();</script>`;
}

function withBridge(html: string, id: number): string {
  const script = bridgeScript(id);
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + script)
    : script + html;
}

export const WebView = forwardRef<WebViewHandle, WebViewProps>(
  ({ source, style, scrollEnabled, pointerEvents, onMessage, onLoadStart, onLoadEnd }, ref) => {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const idRef = useRef(nextFrameId++);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useImperativeHandle(ref, () => ({
      injectJavaScript: (js: string) => {
        frameRef.current?.contentWindow?.postMessage(
          { __rnwv: idRef.current, __rnwvEval: js },
          '*'
        );
      },
    }));

    useEffect(() => {
      const handler = (e: MessageEvent) => {
        const d = e.data;
        if (
          e.source !== frameRef.current?.contentWindow ||
          !d ||
          d.__rnwv !== idRef.current ||
          typeof d.data !== 'string'
        ) {
          return;
        }
        onMessageRef.current?.({ nativeEvent: { data: d.data } });
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, []);

    const srcDoc = useMemo(
      () => (source.html != null ? withBridge(source.html, idRef.current) : undefined),
      [source.html]
    );

    useEffect(() => {
      onLoadStart?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [srcDoc, source.uri]);

    // react-native-web has no iframe primitive, so render the DOM element.
    return React.createElement('iframe' as any, {
      ref: frameRef,
      srcDoc,
      src: srcDoc === undefined ? source.uri : undefined,
      // Scripts only, no same-origin: note content is untrusted, so it must not
      // get access to the app's origin (cookies, storage, tokens).
      sandbox: 'allow-scripts allow-popups',
      scrolling: scrollEnabled === false ? 'no' : undefined,
      onLoad: () => onLoadEnd?.(),
      style: {
        border: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
        ...(pointerEvents === 'none' ? { pointerEvents: 'none' } : null),
        ...(StyleSheet.flatten(style) as object),
      },
    });
  }
);
