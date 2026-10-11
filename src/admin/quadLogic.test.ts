import test from 'node:test';
import assert from 'node:assert/strict';
import { rectToQuad, quadToRect, edgeMidpoint, moveEdge, loupeLayout } from './quadLogic.ts';
import { dragRect, handlePoint } from './cropLogic.ts';

const box = { w: 300, h: 400 };
const rect = { x: 50, y: 60, w: 100, h: 200 };

test('rectToQuad gives TL, TR, BR, BL', () => {
  assert.deepEqual(rectToQuad(rect), [
    { x: 50, y: 60 },
    { x: 150, y: 60 },
    { x: 150, y: 260 },
    { x: 50, y: 260 },
  ]);
});

test('plain -> perspective -> plain keeps the same crop (corners are not reset)', () => {
  assert.deepEqual(quadToRect(rectToQuad(rect), box), rect);
});

test('quadToRect takes the bounding box of a skewed quad, kept inside the box', () => {
  const skewed = [
    { x: 40, y: 50 },
    { x: 160, y: 70 },
    { x: 170, y: 270 },
    { x: 30, y: 250 },
  ] as const;
  assert.deepEqual(quadToRect([...skewed] as never, box), { x: 30, y: 50, w: 140, h: 220 });
  const outside = [
    { x: -10, y: -5 },
    { x: 320, y: 0 },
    { x: 320, y: 410 },
    { x: 0, y: 410 },
  ];
  assert.deepEqual(quadToRect(outside as never, box), { x: 0, y: 0, w: 300, h: 400 });
});

test('edgeMidpoint is the middle of each side', () => {
  const q = rectToQuad(rect);
  assert.deepEqual(edgeMidpoint(q, 0), { x: 100, y: 60 }); // top
  assert.deepEqual(edgeMidpoint(q, 1), { x: 150, y: 160 }); // right
  assert.deepEqual(edgeMidpoint(q, 2), { x: 100, y: 260 }); // bottom
  assert.deepEqual(edgeMidpoint(q, 3), { x: 50, y: 160 }); // left
});

test('pulling the top side moves only its two corners, and only vertically', () => {
  const q = rectToQuad(rect);
  const out = moveEdge(q, 0, 25, -20, box); // dx is along the side, so ignored
  assert.deepEqual(out[0], { x: 50, y: 40 });
  assert.deepEqual(out[1], { x: 150, y: 40 });
  assert.deepEqual(out[2], q[2]);
  assert.deepEqual(out[3], q[3]);
});

test('pulling the right side moves it horizontally', () => {
  const out = moveEdge(rectToQuad(rect), 1, 30, 99, box);
  assert.deepEqual(out[1], { x: 180, y: 60 });
  assert.deepEqual(out[2], { x: 180, y: 260 });
});

test('a side cannot be pulled out of the box', () => {
  const q = rectToQuad(rect);
  assert.equal(moveEdge(q, 0, 0, -1000, box)[0].y, 0);
  assert.equal(moveEdge(q, 2, 0, 1000, box)[3].y, 400);
  assert.equal(moveEdge(q, 3, -1000, 0, box)[0].x, 0);
  assert.equal(moveEdge(q, 1, 1000, 0, box)[2].x, 300);
});

test('a skewed side moves along its own perpendicular', () => {
  // Top side tilted: (0,0) -> (100,100) has a 45 degree normal.
  const q = [
    { x: 100, y: 100 },
    { x: 200, y: 200 },
    { x: 200, y: 300 },
    { x: 100, y: 300 },
  ];
  const out = moveEdge(q as never, 0, 10, 0, box);
  const dx = out[0].x - 100;
  const dy = out[0].y - 100;
  assert.ok(Math.abs(dx + dy) < 1e-9, 'moves along (-1, 1)/sqrt2 up to sign');
  assert.ok(Math.abs(Math.hypot(dx, dy) - 10 / Math.SQRT2) < 1e-9);
  assert.deepEqual(out[1].x - 200, dx);
});

test('a zero-length side is left alone', () => {
  const q = [
    { x: 50, y: 50 },
    { x: 50, y: 50 },
    { x: 150, y: 250 },
    { x: 50, y: 250 },
  ];
  assert.deepEqual(moveEdge(q as never, 0, 20, 20, box), q);
});

test('loupe floats above the finger, centred horizontally', () => {
  const l = loupeLayout({ x: 150, y: 300 }, box, 100, 3, 40);
  assert.deepEqual(l.circle, { left: 100, top: 160 });
  // the dragged point sits at the circle centre: image offset = size/2 - pt*zoom
  assert.deepEqual(l.image, { x: 50 - 450, y: 50 - 900, w: 900, h: 1200 });
});

test('loupe flips below the finger near the top and stays inside the box', () => {
  const l = loupeLayout({ x: 5, y: 10 }, box, 100, 3, 40);
  assert.equal(l.circle.top, 50); // below the finger
  assert.equal(l.circle.left, 0); // clamped to the left edge
  const r = loupeLayout({ x: 299, y: 390 }, box, 100, 3, 40);
  assert.equal(r.circle.left, 200); // clamped to the right edge
  assert.ok(r.circle.top >= 0 && r.circle.top <= 300);
});

test('dragRect pulls a single side', () => {
  const start = { x: 50, y: 50, w: 100, h: 100 };
  assert.deepEqual(dragRect(start, 'r', 30, 999, box), { x: 50, y: 50, w: 130, h: 100 });
  assert.deepEqual(dragRect(start, 'l', -20, 999, box), { x: 30, y: 50, w: 120, h: 100 });
  assert.deepEqual(dragRect(start, 't', 999, -20, box), { x: 50, y: 30, w: 100, h: 120 });
  assert.deepEqual(dragRect(start, 'b', 999, 40, box), { x: 50, y: 50, w: 100, h: 140 });
  // a side cannot cross the opposite one
  assert.equal(dragRect(start, 'r', -500, 0, box).w >= 48, true);
});

test('handlePoint gives corners and side midpoints', () => {
  const r = { x: 50, y: 60, w: 100, h: 200 };
  assert.deepEqual(handlePoint(r, 'tl'), { x: 50, y: 60 });
  assert.deepEqual(handlePoint(r, 'br'), { x: 150, y: 260 });
  assert.deepEqual(handlePoint(r, 'l'), { x: 50, y: 160 });
  assert.deepEqual(handlePoint(r, 'r'), { x: 150, y: 160 });
  assert.deepEqual(handlePoint(r, 't'), { x: 100, y: 60 });
  assert.deepEqual(handlePoint(r, 'b'), { x: 100, y: 260 });
});
