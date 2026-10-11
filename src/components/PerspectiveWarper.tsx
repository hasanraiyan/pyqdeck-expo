import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { WARP_HTML, quadOutputSize, type Quad } from '../admin/perspectiveLogic';

/**
 * Invisible WebView that flattens a photographed page: give it an image and
 * the four page corners (source pixels) and it returns a rectified JPEG.
 * Pure JS (canvas), so no native module beyond the WebView already in the app.
 */
export type PerspectiveWarperHandle = {
  warp: (uri: string, quad: Quad) => Promise<string>;
};

type Pending = { resolve: (uri: string) => void; reject: (e: Error) => void };

export const PerspectiveWarper = forwardRef<PerspectiveWarperHandle>((_, ref) => {
  const web = useRef<WebView>(null);
  const ready = useRef<Promise<void> | null>(null);
  const markReady = useRef<() => void>(() => {});
  const pending = useRef<Pending | null>(null);

  if (!ready.current) {
    ready.current = new Promise<void>((res) => {
      markReady.current = res;
    });
  }

  useImperativeHandle(ref, () => ({
    warp: async (uri, quad) => {
      await ready.current;
      if (pending.current) throw new Error('A warp is already running.');
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { w, h } = quadOutputSize(quad);
      const msg = {
        b64,
        ow: w,
        oh: h,
        quad: quad.map((p) => [p.x, p.y]),
      };
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current = null;
          reject(new Error('Perspective fix timed out.'));
        }, 60000);
        pending.current = {
          resolve: (u) => {
            clearTimeout(timer);
            resolve(u);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        };
        web.current?.injectJavaScript(`window.__warp(${JSON.stringify(msg)}); true;`);
      });
    },
  }));

  const onMessage = async (e: WebViewMessageEvent) => {
    let data: { ready?: boolean; b64?: string; error?: string };
    try {
      data = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (data.ready) {
      markReady.current();
      return;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (data.error || !data.b64) {
      p.reject(new Error(data.error || 'Perspective fix failed.'));
      return;
    }
    try {
      const out = `${FileSystem.cacheDirectory}page-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(out, data.b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      p.resolve(out);
    } catch (err) {
      p.reject(err instanceof Error ? err : new Error('Could not save image.'));
    }
  };

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html: WARP_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        style={styles.web}
      />
    </View>
  );
});
PerspectiveWarper.displayName = 'PerspectiveWarper';

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  web: { width: 1, height: 1 },
});
