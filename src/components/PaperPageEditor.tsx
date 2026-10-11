import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../theme/colors';
import {
  dragRect,
  fitScale,
  toSourceCrop,
  type Handle,
  type Rect,
  type Size,
} from '../admin/cropLogic';

/**
 * Full-screen page editor for scanned paper pages: crop with draggable
 * corners, rotate in 90° steps, and straighten a tilted page with a fine
 * slider. Uses expo-image-manipulator; 90° turns are baked immediately, the
 * fine tilt + crop are applied once on "Done".
 */

const MAX_TILT = 15;
const HANDLE = 28;

type Base = { uri: string; w: number; h: number };

const save = async (ctx: ReturnType<typeof ImageManipulator.manipulate>) => {
  const ref = await ctx.renderAsync();
  return ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
};

const initialCrop = (box: Size): Rect => ({
  x: box.w * 0.05,
  y: box.h * 0.05,
  w: box.w * 0.9,
  h: box.h * 0.9,
});

const CornerHandle = ({
  handle,
  rectRef,
  box,
  onChange,
  style,
}: {
  handle: Handle;
  rectRef: React.MutableRefObject<Rect>;
  box: Size;
  onChange: (r: Rect) => void;
  style: object;
}) => {
  const start = useRef<Rect>(rectRef.current);
  const boxRef = useRef(box);
  boxRef.current = box;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = rectRef.current;
        },
        onPanResponderMove: (_, g) =>
          onChange(dragRect(start.current, handle, g.dx, g.dy, boxRef.current)),
      }),
    [handle, onChange, rectRef]
  );
  return <View {...responder.panHandlers} style={style} hitSlop={10} />;
};

export const PaperPageEditor = ({
  uri,
  pageLabel,
  onCancel,
  onDone,
}: {
  uri: string | null;
  pageLabel: string;
  onCancel: () => void;
  onDone: (newUri: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState<Base | null>(null);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [tilt, setTilt] = useState(0);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const rectRef = useRef(crop);
  rectRef.current = crop;
  const trackW = useRef(1);

  // Load (and EXIF-normalise) the image whenever a new page is opened.
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    setBase(null);
    setTilt(0);
    setFailed(false);
    (async () => {
      try {
        const ref = await ImageManipulator.manipulate(uri).renderAsync();
        if (alive) setBase({ uri, w: ref.width, h: ref.height });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri]);

  const scale = base && area.w > 0 ? fitScale(base, { w: area.w - 24, h: area.h - 24 }) : 1;
  const box: Size = base ? { w: base.w * scale, h: base.h * scale } : { w: 0, h: 0 };

  // Reset the crop frame when the box changes shape (load / 90° turn / resize).
  const boxKey = `${Math.round(box.w)}x${Math.round(box.h)}`;
  useEffect(() => {
    if (box.w > 0) setCrop(initialCrop(box));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxKey]);

  const onAreaLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const rotate90 = async (dir: 1 | -1) => {
    if (!base || busy) return;
    setBusy(true);
    try {
      const out = await save(ImageManipulator.manipulate(base.uri).rotate(90 * dir));
      setBase({ uri: out.uri, w: out.width, h: out.height });
      setTilt(0);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!base || busy) return;
    setBusy(true);
    try {
      let ctx = ImageManipulator.manipulate(base.uri);
      if (tilt !== 0) ctx = ctx.rotate(tilt);
      ctx = ctx.crop(toSourceCrop(crop, scale, base, tilt));
      const out = await save(ctx);
      onDone(out.uri);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const setTiltClamped = useCallback((v: number) => {
    setTilt(Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.round(v * 2) / 2)));
  }, []);

  const sliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) =>
          setTiltClamped(((e.nativeEvent.locationX / trackW.current) * 2 - 1) * MAX_TILT),
        onPanResponderMove: (e) =>
          setTiltClamped(((e.nativeEvent.locationX / trackW.current) * 2 - 1) * MAX_TILT),
      }),
    [setTiltClamped]
  );

  const movePan = useRef<Rect>(crop);
  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          movePan.current = rectRef.current;
        },
        onPanResponderMove: (_, g) =>
          setCrop(dragRect(movePan.current, 'move', g.dx, g.dy, boxRef.current)),
      }),
    []
  );
  const boxRef = useRef(box);
  boxRef.current = box;

  const thumbLeft = ((tilt + MAX_TILT) / (2 * MAX_TILT)) * 100;
  const ready = !!base && box.w > 0;

  return (
    <Modal
      visible={!!uri}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={10} style={styles.topBtn}>
            <Text style={styles.topCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{pageLabel}</Text>
          <TouchableOpacity onPress={apply} disabled={!ready || busy} hitSlop={10} style={styles.topBtn}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.topDone, !ready && { opacity: 0.4 }]}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.canvas} onLayout={onAreaLayout}>
          {failed ? (
            <Text style={styles.msg}>Couldn't edit this image. Go back and try another.</Text>
          ) : !ready ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ width: box.w, height: box.h, backgroundColor: '#111' }}>
              <Image
                source={{ uri: base!.uri }}
                style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${tilt}deg` }] }]}
                contentFit="fill"
              />
              {/* Dim everything outside the crop frame */}
              <View style={[styles.dim, { left: 0, top: 0, right: 0, height: crop.y }]} pointerEvents="none" />
              <View
                style={[styles.dim, { left: 0, top: crop.y + crop.h, right: 0, bottom: 0 }]}
                pointerEvents="none"
              />
              <View
                style={[styles.dim, { left: 0, top: crop.y, width: crop.x, height: crop.h }]}
                pointerEvents="none"
              />
              <View
                style={[styles.dim, { left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }]}
                pointerEvents="none"
              />
              {/* Frame (drag to move) */}
              <View
                {...moveResponder.panHandlers}
                style={[styles.frame, { left: crop.x, top: crop.y, width: crop.w, height: crop.h }]}
              >
                <View style={[styles.gridV, { left: '33.3%' }]} pointerEvents="none" />
                <View style={[styles.gridV, { left: '66.6%' }]} pointerEvents="none" />
                <View style={[styles.gridH, { top: '33.3%' }]} pointerEvents="none" />
                <View style={[styles.gridH, { top: '66.6%' }]} pointerEvents="none" />
              </View>
              {(['tl', 'tr', 'bl', 'br'] as const).map((h) => (
                <CornerHandle
                  key={h}
                  handle={h}
                  rectRef={rectRef}
                  box={box}
                  onChange={setCrop}
                  style={[
                    styles.handle,
                    {
                      left: (h === 'tl' || h === 'bl' ? crop.x : crop.x + crop.w) - HANDLE / 2,
                      top: (h === 'tl' || h === 'tr' ? crop.y : crop.y + crop.h) - HANDLE / 2,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.tools}>
          <View style={styles.tiltRow}>
            <TouchableOpacity onPress={() => setTiltClamped(tilt - 0.5)} hitSlop={8}>
              <Feather name="rotate-ccw" size={16} color="#fff" />
            </TouchableOpacity>
            <View
              style={styles.track}
              onLayout={(e) => (trackW.current = Math.max(1, e.nativeEvent.layout.width))}
              {...sliderResponder.panHandlers}
            >
              <View style={styles.trackLine} pointerEvents="none" />
              <View style={styles.trackMid} pointerEvents="none" />
              <View style={[styles.thumb, { left: `${thumbLeft}%` }]} pointerEvents="none" />
            </View>
            <TouchableOpacity onPress={() => setTiltClamped(tilt + 0.5)} hitSlop={8}>
              <Feather name="rotate-cw" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.tiltValue}>{tilt > 0 ? '+' : ''}{tilt.toFixed(1)}°</Text>
          </View>
          <View style={styles.btnRow}>
            <ToolBtn icon="rotate-ccw" label="Rotate left" onPress={() => rotate90(-1)} disabled={!ready || busy} />
            <ToolBtn icon="rotate-cw" label="Rotate right" onPress={() => rotate90(1)} disabled={!ready || busy} />
            <ToolBtn
              icon="maximize"
              label="Reset crop"
              onPress={() => {
                setTilt(0);
                setCrop(initialCrop(box));
              }}
              disabled={!ready || busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ToolBtn = ({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.toolBtn, disabled && { opacity: 0.4 }]}
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={label}
  >
    <Feather name={icon} size={20} color="#fff" />
    <Text style={styles.toolLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBtn: { minWidth: 60 },
  topCancel: { fontFamily: FONTS.bodySemi, fontSize: 15, color: '#fff' },
  topDone: { fontFamily: FONTS.displayBold, fontSize: 15, color: COLORS.primary, textAlign: 'right' },
  topTitle: { fontFamily: FONTS.displayBold, fontSize: 14, color: '#fff' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msg: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#fff', textAlign: 'center', padding: 24 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderWidth: 1.5, borderColor: '#fff' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  tools: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 12 },
  tiltRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 36, justifyContent: 'center' },
  trackLine: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  trackMid: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 12,
    marginLeft: -1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  tiltValue: { width: 52, fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff', textAlign: 'right' },
  btnRow: { flexDirection: 'row', justifyContent: 'space-around' },
  toolBtn: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12 },
  toolLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: '#fff' },
});
