import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { loupeLayout } from '../admin/quadLogic';
import type { Pt } from '../admin/perspectiveLogic';
import type { Size } from '../admin/cropLogic';

const SIZE = 112;
const ZOOM = 3;

/**
 * A magnifier shown while a corner is dragged: a circle floating above the
 * finger (so the finger never hides it) that shows the page around the corner
 * at 3x, with the corner itself at the centre crosshair. Same image and tilt as
 * the editor, scaled uniformly, so it matches what is under the finger.
 */
export const CornerLoupe = ({
  uri,
  box,
  tiltDeg,
  pt,
}: {
  uri: string;
  box: Size;
  tiltDeg: number;
  pt: Pt;
}) => {
  const { circle, image } = loupeLayout(pt, box, SIZE, ZOOM);
  return (
    <View pointerEvents="none" style={[styles.loupe, { left: circle.left, top: circle.top }]}>
      <View style={{ position: 'absolute', left: image.x, top: image.y, width: image.w, height: image.h }}>
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${tiltDeg}deg` }] }]}
          contentFit="fill"
        />
      </View>
      {/* Ring and crosshair are separate from the clipped picture so the border
          cannot shift the centre off the corner being placed. */}
      <View style={styles.ring} />
      <View style={styles.crossH} />
      <View style={styles.crossV} />
    </View>
  );
};

const styles = StyleSheet.create({
  loupe: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  crossH: {
    position: 'absolute',
    left: SIZE / 2 - 9,
    top: SIZE / 2 - 0.75,
    width: 18,
    height: 1.5,
    backgroundColor: '#ff3b30',
  },
  crossV: {
    position: 'absolute',
    left: SIZE / 2 - 0.75,
    top: SIZE / 2 - 9,
    width: 1.5,
    height: 18,
    backgroundColor: '#ff3b30',
  },
});
