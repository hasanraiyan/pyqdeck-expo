import test from 'node:test';
import assert from 'node:assert/strict';
import { clampRect, dragRect, fitScale, rotatedSize, toSourceCrop } from './cropLogic.ts';

const box = { w: 300, h: 400 };

test('fitScale fits the image inside the area', () => {
  assert.equal(fitScale({ w: 1000, h: 2000 }, { w: 500, h: 500 }), 0.25);
  assert.equal(fitScale({ w: 0, h: 0 }, { w: 500, h: 500 }), 1);
});

test('clampRect keeps the rect inside the box', () => {
  const r = clampRect({ x: -20, y: 390, w: 500, h: 100 }, box);
  assert.deepEqual(r, { x: 0, y: 300, w: 300, h: 100 });
});

test('dragRect moves and resizes within bounds', () => {
  const start = { x: 50, y: 50, w: 100, h: 100 };
  assert.deepEqual(dragRect(start, 'move', 1000, 1000, box), { x: 200, y: 300, w: 100, h: 100 });
  assert.deepEqual(dragRect(start, 'br', 20, 30, box), { x: 50, y: 50, w: 120, h: 130 });
  const tl = dragRect(start, 'tl', 500, 500, box);
  assert.equal(tl.w >= 48 && tl.h >= 48, true);
});

test('rotatedSize swaps at 90 degrees', () => {
  const s = rotatedSize({ w: 100, h: 200 }, 90);
  assert.equal(Math.round(s.w), 200);
  assert.equal(Math.round(s.h), 100);
});

test('toSourceCrop maps without tilt', () => {
  const c = toSourceCrop({ x: 10, y: 20, w: 100, h: 50 }, 0.5, { w: 600, h: 800 }, 0);
  assert.deepEqual(c, { originX: 20, originY: 40, width: 200, height: 100 });
});

test('toSourceCrop stays inside the rotated canvas', () => {
  const img = { w: 600, h: 800 };
  const c = toSourceCrop({ x: 0, y: 0, w: 300, h: 400 }, 0.5, img, 10);
  const canvas = rotatedSize(img, 10);
  assert.equal(c.originX + c.width <= canvas.w, true);
  assert.equal(c.originY + c.height <= canvas.h, true);
});

import { WARP_SOURCE, isValidQuad, quadOutputSize, type Quad } from './perspectiveLogic.ts';

const warpPixels = new Function(`${WARP_SOURCE}; return warpPixels;`)() as (
  src: Uint8ClampedArray, sw: number, sh: number, quad: number[][], ow: number, oh: number
) => Uint8ClampedArray;

test('quadOutputSize uses the longer opposite edges and caps size', () => {
  const q: Quad = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 90, y: 200 }, { x: 0, y: 180 }];
  const s = quadOutputSize(q);
  assert.equal(s.w, 100);
  assert.equal(s.h, 190);
  assert.equal(quadOutputSize([{ x: 0, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 4500 }, { x: 0, y: 4500 }]).w, 2400);
});

test('isValidQuad rejects bow-ties and degenerate quads', () => {
  const good: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(isValidQuad(good), true);
  assert.equal(isValidQuad([good[0], good[2], good[1], good[3]]), false);
  assert.equal(isValidQuad([good[0], good[0], good[0], good[0]]), false);
});

test('warpPixels maps a skewed quad back to the full image', () => {
  // 8x8 source: left half red, right half blue; quad = whole image.
  const sw = 8, sh = 8;
  const src = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      src[i] = x < 4 ? 255 : 0;
      src[i + 2] = x < 4 ? 0 : 255;
      src[i + 3] = 255;
    }
  const out = warpPixels(src, sw, sh, [[0, 0], [7, 0], [7, 7], [0, 7]], 8, 8);
  assert.equal(out[0], 255); // top-left red
  assert.equal(out[(7 * 8 + 7) * 4 + 2], 255); // bottom-right blue
  // A narrower quad on the red half yields all red.
  const red = warpPixels(src, sw, sh, [[0, 0], [2, 1], [2, 6], [0, 7]], 4, 4);
  for (let p = 0; p < 16; p++) assert.equal(red[p * 4], 255);
});
