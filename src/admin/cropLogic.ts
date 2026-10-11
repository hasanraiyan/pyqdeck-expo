/**
 * Pure geometry for the paper page editor (crop + tilt). Kept free of React
 * Native imports so it runs under `node --test`.
 *
 * Model: the editor shows the source image (w x h) scaled by `scale` inside a
 * display box. The crop rect lives in display coordinates. A tilt of `deg`
 * degrees is applied about the image centre; expo-image-manipulator's rotate()
 * grows the canvas to fit, so the display box maps onto the centre of the
 * rotated canvas.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export const MIN_CROP = 48;

export const fitScale = (img: Size, area: Size): number =>
  img.w <= 0 || img.h <= 0 ? 1 : Math.min(area.w / img.w, area.h / img.h);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Keep a rect inside the box and at least MIN_CROP in each dimension. */
export const clampRect = (r: Rect, box: Size, min = MIN_CROP): Rect => {
  const w = clamp(r.w, Math.min(min, box.w), box.w);
  const h = clamp(r.h, Math.min(min, box.h), box.h);
  return { x: clamp(r.x, 0, box.w - w), y: clamp(r.y, 0, box.h - h), w, h };
};

// Corners resize two sides at once; 'l' | 'r' | 't' | 'b' pull a single side.
export type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 't' | 'b' | 'move';

/** Apply a drag of (dx, dy) from the rect captured at gesture start. */
export const dragRect = (start: Rect, handle: Handle, dx: number, dy: number, box: Size): Rect => {
  if (handle === 'move') {
    return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, box);
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle === 'tl' || handle === 'bl' || handle === 'l') left = clamp(left + dx, 0, right - MIN_CROP);
  if (handle === 'tr' || handle === 'br' || handle === 'r') right = clamp(right + dx, left + MIN_CROP, box.w);
  if (handle === 'tl' || handle === 'tr' || handle === 't') top = clamp(top + dy, 0, bottom - MIN_CROP);
  if (handle === 'bl' || handle === 'br' || handle === 'b') bottom = clamp(bottom + dy, top + MIN_CROP, box.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
};

/** The point a handle sits on: a corner, or the middle of a side. */
export const handlePoint = (r: Rect, handle: Exclude<Handle, 'move'>): { x: number; y: number } => {
  const left = r.x;
  const right = r.x + r.w;
  const top = r.y;
  const bottom = r.y + r.h;
  const midX = r.x + r.w / 2;
  const midY = r.y + r.h / 2;
  switch (handle) {
    case 'tl':
      return { x: left, y: top };
    case 'tr':
      return { x: right, y: top };
    case 'bl':
      return { x: left, y: bottom };
    case 'br':
      return { x: right, y: bottom };
    case 'l':
      return { x: left, y: midY };
    case 'r':
      return { x: right, y: midY };
    case 't':
      return { x: midX, y: top };
    default:
      return { x: midX, y: bottom };
  }
};

/** Size of the canvas after rotating a w x h image by `deg` degrees. */
export const rotatedSize = (img: Size, deg: number): Size => {
  const rad = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return { w: img.w * c + img.h * s, h: img.w * s + img.h * c };
};

/**
 * Map a display-space crop rect to a pixel rect on the (possibly tilted)
 * image, clamped to the rotated canvas so the manipulator never rejects it.
 */
export const toSourceCrop = (crop: Rect, scale: number, img: Size, tiltDeg: number) => {
  const canvas = rotatedSize(img, tiltDeg);
  const offX = (canvas.w - img.w) / 2;
  const offY = (canvas.h - img.h) / 2;
  const originX = clamp(Math.round(crop.x / scale + offX), 0, Math.floor(canvas.w) - 1);
  const originY = clamp(Math.round(crop.y / scale + offY), 0, Math.floor(canvas.h) - 1);
  const width = clamp(Math.round(crop.w / scale), 1, Math.floor(canvas.w) - originX);
  const height = clamp(Math.round(crop.h / scale), 1, Math.floor(canvas.h) - originY);
  return { originX, originY, width, height };
};
