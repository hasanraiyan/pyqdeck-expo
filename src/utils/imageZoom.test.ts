import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_SOURCE, zoomHtml } from './imageZoom.ts';

// Evaluate the exact string that ships in the WebView page.
const z = new Function(
  `${ZOOM_SOURCE}
   return { fitSize, clampTranslate, zoomAround, doubleTapTarget, MAX_SCALE, DOUBLE_TAP_SCALE };`
)() as {
  fitSize: (vw: number, vh: number, iw: number, ih: number) => { w: number; h: number };
  clampTranslate: (...a: number[]) => { x: number; y: number };
  zoomAround: (...a: number[]) => { s: number; x: number; y: number };
  doubleTapTarget: (...a: number[]) => { s: number; x: number; y: number };
  MAX_SCALE: number;
  DOUBLE_TAP_SCALE: number;
};

// A portrait page in a portrait phone viewport.
const vw = 400;
const vh = 800;
const fit = z.fitSize(vw, vh, 2000, 2800); // contain: width-limited -> 400 x 560
const dw = fit.w;
const dh = fit.h;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('fitSize contains the image and handles bad sizes', () => {
  assert.deepEqual(fit, { w: 400, h: 560 });
  assert.deepEqual(z.fitSize(400, 800, 0, 0), { w: 400, h: 800 });
});

test('at scale 1 the page stays centred and cannot be dragged away', () => {
  assert.deepEqual(z.clampTranslate(1, 90, -70, vw, vh, dw, dh), { x: 0, y: 0 });
});

test('zoomed in, dragging stops at the page edges (no blank gap)', () => {
  const s = 3; // 1200 x 1680 on a 400 x 800 screen
  const far = z.clampTranslate(s, 5000, 5000, vw, vh, dw, dh);
  // left edge cannot move right of the viewport's left edge
  assert.ok(near(far.x + (vw - dw) / 2, 0));
  assert.ok(near(far.y + (vh - dh) / 2, 0));
  const other = z.clampTranslate(s, -5000, -5000, vw, vh, dw, dh);
  assert.ok(near(other.x + (vw - dw) / 2, vw - dw * s));
  assert.ok(near(other.y + (vh - dh) / 2, vh - dh * s));
});

test('zoomAround keeps the point under the finger in place', () => {
  const px = 250;
  const py = 380;
  const before = { s: 1, x: 0, y: 0 };
  const after = z.zoomAround(before.s, before.x, before.y, 2.5, px, py, vw, vh, dw, dh);
  const bx = (vw - dw) / 2;
  const by = (vh - dh) / 2;
  // image-local point under the finger, before and after
  const u0 = (px - bx - before.x) / before.s;
  const v0 = (py - by - before.y) / before.s;
  const u1 = (px - bx - after.x) / after.s;
  const v1 = (py - by - after.y) / after.s;
  assert.ok(near(u0, u1, 1e-6) && near(v0, v1, 1e-6));
});

test('scale is clamped between 1 and the maximum', () => {
  assert.equal(z.zoomAround(1, 0, 0, 99, 200, 400, vw, vh, dw, dh).s, z.MAX_SCALE);
  const back = z.zoomAround(3, 0, 0, 0.2, 200, 400, vw, vh, dw, dh);
  assert.equal(back.s, 1);
  assert.ok(near(back.x, 0) && near(back.y, 0)); // back to centred
});

test('double tap zooms in on the tapped spot, then back out', () => {
  const inn = z.doubleTapTarget(1, 0, 0, 300, 300, vw, vh, dw, dh);
  assert.equal(inn.s, z.DOUBLE_TAP_SCALE);
  const out = z.doubleTapTarget(inn.s, inn.x, inn.y, 300, 300, vw, vh, dw, dh);
  assert.deepEqual(out, { s: 1, x: 0, y: 0 });
});

test('double tap in a corner never reveals empty space', () => {
  const inn = z.doubleTapTarget(1, 0, 0, 2, 2 + (vh - dh) / 2, vw, vh, dw, dh);
  const clamped = z.clampTranslate(inn.s, inn.x, inn.y, vw, vh, dw, dh);
  assert.deepEqual({ x: inn.x, y: inn.y }, clamped);
});

test('a slightly zoomed page counts as zoomed for the double-tap toggle', () => {
  assert.deepEqual(z.doubleTapTarget(1.2, 0, 0, 100, 100, vw, vh, dw, dh), { s: 1, x: 0, y: 0 });
});

test('zoomHtml embeds the maths, disables native zoom, and escapes the URL', () => {
  const html = zoomHtml('https://cdn.test/a"b.jpg?x=1&y=2');
  assert.ok(html.includes('function doubleTapTarget'));
  assert.ok(html.includes('user-scalable=no'));
  assert.ok(html.includes('a&quot;b.jpg'));
  assert.ok(!html.includes('a"b.jpg'));
  assert.ok(html.includes("addEventListener('touchstart'"));
});
