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
