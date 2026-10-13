import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Circle, Path, Rect, RadialGradient, Stop } from 'react-native-svg';
import { COLORS } from '../theme/colors';

// Loading state shown while a diagram waits its turn in the draw queue: a still
// grid of faint dots where individual dots twinkle on their own, strongest in the
// middle of the rectangle and fading out toward the edges.
//
// Animating hundreds of dots one by one would be heavy, so the twinkle uses a few
// layers instead: every dot of the grid is assigned (pseudo-randomly) to one of
// TWINKLE_LAYERS, and each layer pulses its own opacity at its own speed and
// phase on the native side. Together they read as dots lighting up at random, and
// they keep going while the JS thread is busy drawing the diagram.
//
// Layers, bottom to top:
//   1. TWINKLE_LAYERS bright-dot layers (animated)
//   2. a fixed cover in the surface colour with a soft opening in the middle
//   3. faint dots, full grid, so the whole rectangle always reads as a dot grid
const DOT_CELL = 14;
const TILE_COLS = 11;
const TILE_ROWS = 7;
const TWINKLE_LAYERS = 6;
// How far the twinkling reaches from the centre (1 = to the corners).
const ENVELOPE_REACH = 0.95;

// Cells of one pattern tile, split across the layers with a fixed scramble so the
// result looks random but never changes between renders.
const LAYER_CELLS: Array<Array<[number, number]>> = Array.from({ length: TWINKLE_LAYERS }, () => []);
for (let y = 0; y < TILE_ROWS; y++) {
  for (let x = 0; x < TILE_COLS; x++) {
    const layer = (x * 7 + y * 13 + x * y * 3 + ((x ^ y) % 5)) % TWINKLE_LAYERS;
    LAYER_CELLS[layer].push([x, y]);
  }
}

// One <Path> holding every dot of a layer's tile (each dot is two arcs). Creating
// a native view per dot made each placeholder cost ~150ms to mount; one path
// per layer keeps it to a handful of views.
function dotsPath(cells: Array<[number, number]>, r: number): string {
  return cells
    .map(([x, y]) => {
      const cx = x * DOT_CELL + DOT_CELL / 2;
      const cy = y * DOT_CELL + DOT_CELL / 2;
      return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    })
    .join('');
}

const DotLayer: React.FC<{ id: string; color: string; r: number; cells: Array<[number, number]> }> = ({
  id,
  color,
  r,
  cells,
}) => (
  <Svg width="100%" height="100%">
    <Defs>
      <Pattern
        id={id}
        width={DOT_CELL * TILE_COLS}
        height={DOT_CELL * TILE_ROWS}
        patternUnits="userSpaceOnUse"
      >
        <Path d={dotsPath(cells, r)} fill={color} />
      </Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#${id})`} />
  </Svg>
);

// The faint grid has one dot per cell, so it needs a plain small tile.
const DimGrid: React.FC<{ color: string }> = ({ color }) => (
  <Svg width="100%" height="100%">
    <Defs>
      <Pattern id="dg-dim" width={DOT_CELL} height={DOT_CELL} patternUnits="userSpaceOnUse">
        <Circle cx={DOT_CELL / 2} cy={DOT_CELL / 2} r={1.6} fill={color} />
      </Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#dg-dim)" />
  </Svg>
);

const Cover: React.FC<{ bg: string; reach: number }> = ({ bg, reach }) => (
  <Svg width="100%" height="100%">
    <Defs>
      <RadialGradient id="dg-env" cx="50%" cy="50%" rx={`${reach * 100}%`} ry={`${reach * 100}%`}>
        <Stop offset="0" stopColor={bg} stopOpacity={0} />
        <Stop offset="0.35" stopColor={bg} stopOpacity={0.05} />
        <Stop offset="0.7" stopColor={bg} stopOpacity={0.7} />
        <Stop offset="1" stopColor={bg} stopOpacity={1} />
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#dg-env)" />
  </Svg>
);

interface DiagramPlaceholderProps {
  /** 0 = fully shown, 1 = hidden; omit to keep it shown. */
  fade?: Animated.Value;
  /** Colour of the surface the placeholder sits on (the glow fades into it). */
  bg?: string;
}

export const DiagramPlaceholder: React.FC<DiagramPlaceholderProps> = ({
  fade,
  bg = '#FFFFFF',
}) => {
  const pulses = useRef(Array.from({ length: TWINKLE_LAYERS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = pulses.map((v, i) => {
      const up = 700 + ((i * 337) % 900); // 0.7 – 1.6 s
      const down = 900 + ((i * 521) % 1100); // 0.9 – 2.0 s
      v.setValue(((i * 0.37) % 1));
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: up, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: down, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [pulses]);

  const brightGrids = useMemo(
    () =>
      LAYER_CELLS.map((cells, i) => (
        <DotLayer key={i} id={`dg-bright-${i}`} color={COLORS.primary} r={2.1} cells={cells} />
      )),
    []
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: bg, overflow: 'hidden' },
        fade && { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}
    >
      {pulses.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.06, 1] }) },
          ]}
        >
          {brightGrids[i]}
        </Animated.View>
      ))}

      <View style={StyleSheet.absoluteFill}>
        <Cover bg={bg} reach={ENVELOPE_REACH} />
      </View>

      <View style={StyleSheet.absoluteFill}>
        <DimGrid color="rgba(100,116,139,0.2)" />
      </View>
    </Animated.View>
  );
};
