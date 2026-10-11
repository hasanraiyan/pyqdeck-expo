/**
 * Pure geometry for the perspective (four-corner) page editor: carrying the
 * crop between plain and perspective mode, pulling a single side of the quad,
 * and laying out the zoom loupe. Free of React Native imports so it runs under
 * `node --test`. Self-contained on purpose: the test runner cannot follow
 * imports between source files, so only type imports are used here.
 */
import type { Pt, Quad } from './perspectiveLogic';
import type { Rect, Size } from './cropLogic';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Corners in order TL, TR, BR, BL (the order perspectiveLogic expects). */
export const rectToQuad = (r: Rect): Quad => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/**
 * The plain crop rect that best matches a quad: its bounding box, kept inside
 * the box. Used when switching back from perspective so the corners the admin
 * placed are not thrown away.
 */
export const quadToRect = (q: Quad, box: Size): Rect => {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const left = clamp(Math.min(...xs), 0, box.w);
  const top = clamp(Math.min(...ys), 0, box.h);
  const right = clamp(Math.max(...xs), 0, box.w);
  const bottom = clamp(Math.max(...ys), 0, box.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
};

/**
 * Side i joins corner i to corner (i + 1): 0 top, 1 right, 2 bottom, 3 left.
 * Its handle sits in the middle of that side.
 */
export const edgeMidpoint = (q: Quad, edge: number): Pt => {
  const a = q[edge];
  const b = q[(edge + 1) % 4];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

/**
 * Pull one side of the quad. Both of its corners move together, along the
 * side's own perpendicular only (the component of the drag that pushes the side
 * in or out), so a drag along the side never slides it sideways. Clamped so
 * both corners stay inside the box. Returns the start quad for a zero-length
 * side.
 */
export const moveEdge = (start: Quad, edge: number, dx: number, dy: number, box: Size): Quad => {
  const a = start[edge];
  const b = start[(edge + 1) % 4];
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-6) return start;
  const nx = -ey / len;
  const ny = ex / len;

  // Largest allowed range of the push t so a + n*t and b + n*t stay in the box.
  let lo = -Infinity;
  let hi = Infinity;
  const limit = (p: number, n: number, max: number) => {
    if (Math.abs(n) < 1e-9) return;
    const t1 = (0 - p) / n;
    const t2 = (max - p) / n;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  };
  for (const p of [a, b]) {
    limit(p.x, nx, box.w);
    limit(p.y, ny, box.h);
  }
  const t = clamp(dx * nx + dy * ny, lo, hi);
  const out = start.slice() as Quad;
  out[edge] = { x: a.x + nx * t, y: a.y + ny * t };
  out[(edge + 1) % 4] = { x: b.x + nx * t, y: b.y + ny * t };
  return out;
};

/**
 * Where to draw the zoom loupe while a corner is dragged, and how to place the
 * zoomed image inside it so the corner sits at the circle's centre.
 *
 * The circle floats above the finger (so the finger never covers it) and flips
 * below when the corner is near the top. Coordinates are relative to the image
 * box; `image` is relative to the circle.
 */
export const loupeLayout = (
  pt: Pt,
  box: Size,
  size = 112,
  zoom = 3,
  gap = 48
): { circle: { left: number; top: number }; image: Rect } => {
  const left = clamp(pt.x - size / 2, 0, Math.max(0, box.w - size));
  let top = pt.y - size - gap;
  if (top < 0) top = pt.y + gap;
  top = clamp(top, 0, Math.max(0, box.h - size));
  return {
    circle: { left, top },
    image: {
      x: size / 2 - pt.x * zoom,
      y: size / 2 - pt.y * zoom,
      w: box.w * zoom,
      h: box.h * zoom,
    },
  };
};
