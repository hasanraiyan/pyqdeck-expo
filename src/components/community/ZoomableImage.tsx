import React, { useMemo, useRef } from 'react';
import { Animated, GestureResponderEvent, PanResponder, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 10;

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /** Fires when the image leaves / returns to its fitted size, so a parent pager can stop / resume swiping. */
  onZoomChange?: (zoomed: boolean) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const touchDistance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

const touchCentre = (e: GestureResponderEvent) => {
  const touches = e.nativeEvent.touches;
  const n = touches.length;
  return {
    x: touches.reduce((sum, t) => sum + t.pageX, 0) / n,
    y: touches.reduce((sum, t) => sum + t.pageY, 0) / n,
  };
};

/**
 * Pinch, drag and double-tap zoom in place. Built on PanResponder + Animated
 * because the app ships no gesture-handler / reanimated.
 *
 * It sits in a box of `width` x `height` that starts at the screen origin (the
 * full-screen media viewer), so touch page coordinates are taken relative to
 * the box centre, which is the transform origin. At 1x a single finger is left
 * to the parent pager; the responder is only held for two fingers, a drag
 * while zoomed in, or a double tap.
 */
export const ZoomableImage: React.FC<ZoomableImageProps> = ({ uri, width, height, onZoomChange }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  const cur = useRef({ s: 1, x: 0, y: 0 });
  const start = useRef({ s: 1, x: 0, y: 0, d: 1, cx: 0, cy: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const moved = useRef(false);
  const touchCount = useRef(0);
  const zoomedRef = useRef(false);
  const size = useRef({ width, height });
  size.current = { width, height };
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const apply = (s: number, x: number, y: number, animate = false) => {
    const { width: w, height: h } = size.current;
    const maxX = (w * s - w) / 2;
    const maxY = (h * s - h) / 2;
    const nx = s <= MIN_SCALE ? 0 : clamp(x, -maxX, maxX);
    const ny = s <= MIN_SCALE ? 0 : clamp(y, -maxY, maxY);
    cur.current = { s, x: nx, y: ny };
    if (animate) {
      Animated.parallel([
        Animated.timing(scale, { toValue: s, duration: 200, useNativeDriver: false }),
        Animated.timing(tx, { toValue: nx, duration: 200, useNativeDriver: false }),
        Animated.timing(ty, { toValue: ny, duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      scale.setValue(s);
      tx.setValue(nx);
      ty.setValue(ny);
    }
    const zoomed = s > MIN_SCALE * 1.02;
    if (zoomed !== zoomedRef.current) {
      zoomedRef.current = zoomed;
      onZoomChangeRef.current?.(zoomed);
    }
  };

  // Point on screen, relative to the box centre.
  const fromCentre = (x: number, y: number) => ({
    x: x - size.current.width / 2,
    y: y - size.current.height / 2,
  });

  const beginGesture = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    const c = touchCentre(e);
    start.current = {
      ...cur.current,
      d: touches.length >= 2 ? touchDistance(e) || 1 : 1,
      cx: c.x,
      cy: c.y,
    };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Needed so a double tap at 1x reaches onRelease; a swipe is handed back to the pager.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2 || cur.current.s > MIN_SCALE,
        onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
        onPanResponderTerminationRequest: () => cur.current.s <= MIN_SCALE * 1.02,
        onPanResponderGrant: (e) => {
          moved.current = false;
          touchCount.current = e.nativeEvent.touches.length;
          beginGesture(e);
        },
        onPanResponderMove: (e) => {
          const touches = e.nativeEvent.touches;
          // A finger added or lifted changes the centroid, so re-anchor rather than jump.
          if (touches.length !== touchCount.current) {
            touchCount.current = touches.length;
            beginGesture(e);
          }
          const c = touchCentre(e);
          if (touches.length >= 2) {
            moved.current = true;
            const s0 = start.current.s;
            const s = clamp(s0 * (touchDistance(e) / start.current.d), MIN_SCALE, MAX_SCALE);
            const f0 = fromCentre(start.current.cx, start.current.cy);
            const f1 = fromCentre(c.x, c.y);
            const k = s / s0;
            apply(s, f1.x - (f0.x - start.current.x) * k, f1.y - (f0.y - start.current.y) * k);
          } else if (cur.current.s > MIN_SCALE) {
            const dx = c.x - start.current.cx;
            const dy = c.y - start.current.cy;
            if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) moved.current = true;
            apply(cur.current.s, start.current.x + dx, start.current.y + dy);
          } else {
            const dx = c.x - start.current.cx;
            const dy = c.y - start.current.cy;
            if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) moved.current = true;
          }
        },
        onPanResponderRelease: (e) => {
          const touchesLeft = e.nativeEvent.touches.length;
          if (touchesLeft > 0) return;
          if (cur.current.s < MIN_SCALE * 1.02) apply(MIN_SCALE, 0, 0, true);
          if (moved.current) return;
          const { pageX, pageY } = e.nativeEvent;
          const now = Date.now();
          const prev = lastTap.current;
          if (
            now - prev.t < DOUBLE_TAP_MS &&
            Math.abs(pageX - prev.x) < 40 &&
            Math.abs(pageY - prev.y) < 40
          ) {
            lastTap.current = { t: 0, x: 0, y: 0 };
            if (cur.current.s > MIN_SCALE * 1.05) {
              apply(MIN_SCALE, 0, 0, true);
            } else {
              const f = fromCentre(pageX, pageY);
              const k = DOUBLE_TAP_SCALE / cur.current.s;
              apply(DOUBLE_TAP_SCALE, f.x - (f.x - cur.current.x) * k, f.y - (f.y - cur.current.y) * k, true);
            }
          } else {
            lastTap.current = { t: now, x: pageX, y: pageY };
          }
        },
      }),
    // The responder reads everything through refs, so it is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Animated.View
      style={[styles.box, { width, height }, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      {...responder.panHandlers}
    >
      <Image source={{ uri }} style={styles.image} contentFit="contain" transition={200} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
