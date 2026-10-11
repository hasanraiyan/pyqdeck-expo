/**
 * Pinch / drag / double-tap zoom for the original-paper zoom panel.
 *
 * The panel is a WebView. Android's own double-tap zoom is switched off for
 * mobile-style pages (which this must be), so the gestures are handled here and
 * the image is moved with a CSS transform. The maths lives in ZOOM_SOURCE, a
 * plain-JS string (ES5, no imports) that is both embedded in the page and
 * evaluated by the unit tests, so what is tested is what ships.
 *
 * Model: the image is shown "contain"-fitted in the viewport at a fitted size
 * (dw x dh). The wrapper is placed at the fitted position and then moved by
 * translate(tx, ty) and scaled by s about its own top-left corner.
 */

export const ZOOM_SOURCE = `
var MIN_SCALE = 1;
var MAX_SCALE = 5;
var DOUBLE_TAP_SCALE = 2.5;

// Displayed size of an image (iw x ih) fitted inside the viewport (vw x vh).
function fitSize(vw, vh, iw, ih) {
  if (!(iw > 0) || !(ih > 0) || !(vw > 0) || !(vh > 0)) return { w: vw || 0, h: vh || 0 };
  var f = Math.min(vw / iw, vh / ih);
  return { w: iw * f, h: ih * f };
}

// Keep a zoomed image on screen: no blank gap at an edge while it is larger
// than the viewport, centred while it is smaller. (tx, ty) is the translation
// from the fitted position, in px.
function clampTranslate(s, tx, ty, vw, vh, dw, dh) {
  var sw = dw * s, sh = dh * s;
  var bx = (vw - dw) / 2, by = (vh - dh) / 2;
  var left = bx + tx, top = by + ty;
  var minL, maxL, minT, maxT;
  if (sw <= vw) { minL = maxL = (vw - sw) / 2; } else { minL = vw - sw; maxL = 0; }
  if (sh <= vh) { minT = maxT = (vh - sh) / 2; } else { minT = vh - sh; maxT = 0; }
  left = Math.min(maxL, Math.max(minL, left));
  top = Math.min(maxT, Math.max(minT, top));
  return { x: left - bx, y: top - by };
}

// New scale newS with the point under the finger (px, py) staying put.
function zoomAround(s, tx, ty, newS, px, py, vw, vh, dw, dh) {
  newS = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newS));
  var bx = (vw - dw) / 2, by = (vh - dh) / 2;
  var u = (px - bx - tx) / s;
  var v = (py - by - ty) / s;
  var c = clampTranslate(newS, px - bx - u * newS, py - by - v * newS, vw, vh, dw, dh);
  return { s: newS, x: c.x, y: c.y };
}

// Double tap: zoomed in -> back to fit; otherwise zoom in on the tapped spot.
function doubleTapTarget(s, tx, ty, px, py, vw, vh, dw, dh) {
  if (s > MIN_SCALE * 1.05) return { s: MIN_SCALE, x: 0, y: 0 };
  return zoomAround(s, tx, ty, DOUBLE_TAP_SCALE, px, py, vw, vh, dw, dh);
}
`;

// Touch handling and DOM wiring (not unit tested: it needs a browser). Kept
// thin on purpose; every decision is made by the functions above.
const ZOOM_PAGE_SCRIPT = `
(function () {
  var img = document.getElementById('img');
  var wrap = document.getElementById('wrap');
  var vw = 0, vh = 0, iw = 0, ih = 0, dw = 0, dh = 0;
  var s = 1, tx = 0, ty = 0;

  function apply(animate) {
    wrap.style.transition = animate ? 'transform 200ms ease-out' : 'none';
    wrap.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }
  function layout() {
    vw = window.innerWidth; vh = window.innerHeight;
    if (!iw || !ih) return;
    var f = fitSize(vw, vh, iw, ih);
    dw = f.w; dh = f.h;
    wrap.style.width = dw + 'px';
    wrap.style.height = dh + 'px';
    wrap.style.left = ((vw - dw) / 2) + 'px';
    wrap.style.top = ((vh - dh) / 2) + 'px';
    var c = clampTranslate(s, tx, ty, vw, vh, dw, dh);
    tx = c.x; ty = c.y;
    apply(false);
  }
  img.onload = function () { iw = img.naturalWidth; ih = img.naturalHeight; layout(); };
  if (img.complete && img.naturalWidth) img.onload();
  window.addEventListener('resize', layout);

  var mode = 0; // 0 idle, 1 one finger, 2 two fingers
  var start = {};
  var moved = false;
  var lastTap = { t: 0, x: 0, y: 0 };

  function dist(a, b) {
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function beginPan(t) { mode = 1; moved = false; start = { tx: tx, ty: ty, x: t.clientX, y: t.clientY }; }
  function beginPinch(a, b) {
    mode = 2;
    start = { s: s, tx: tx, ty: ty, d: dist(a, b) || 1, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
  }

  document.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!dw) return;
    if (e.touches.length >= 2) beginPinch(e.touches[0], e.touches[1]);
    else if (e.touches.length === 1) beginPan(e.touches[0]);
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!dw) return;
    if (mode === 2 && e.touches.length >= 2) {
      var a = e.touches[0], b = e.touches[1];
      var mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      var r = zoomAround(start.s, start.tx, start.ty, start.s * (dist(a, b) / start.d), start.mx, start.my, vw, vh, dw, dh);
      var c = clampTranslate(r.s, r.x + (mx - start.mx), r.y + (my - start.my), vw, vh, dw, dh);
      s = r.s; tx = c.x; ty = c.y;
      apply(false);
    } else if (mode === 1 && e.touches.length === 1) {
      var t = e.touches[0];
      var dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (s > 1) {
        var p = clampTranslate(s, start.tx + dx, start.ty + dy, vw, vh, dw, dh);
        tx = p.x; ty = p.y;
        apply(false);
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (!dw) return;
    if (mode === 1 && !moved && e.changedTouches.length === 1) {
      var t = e.changedTouches[0];
      var now = Date.now();
      if (now - lastTap.t < 300 && Math.abs(t.clientX - lastTap.x) < 40 && Math.abs(t.clientY - lastTap.y) < 40) {
        var r = doubleTapTarget(s, tx, ty, t.clientX, t.clientY, vw, vh, dw, dh);
        s = r.s; tx = r.x; ty = r.y;
        apply(true);
        lastTap = { t: 0, x: 0, y: 0 };
      } else {
        lastTap = { t: now, x: t.clientX, y: t.clientY };
      }
    }
    if (e.touches.length === 0) mode = 0;
    else if (e.touches.length === 1) beginPan(e.touches[0]);
  }, { passive: false });

  document.addEventListener('touchcancel', function () { mode = 0; }, { passive: true });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
})();
`;

export const zoomHtml = (src: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-touch-callout: none !important; user-select: none !important; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #f5f6f2; touch-action: none; }
    #wrap { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
    #img { display: block; width: 100%; height: 100%; pointer-events: none; -webkit-user-drag: none; }
  </style>
</head>
<body>
  <div id="wrap"><img id="img" src="${src.replace(/"/g, '&quot;')}" /></div>
  <script>${ZOOM_SOURCE}</script>
  <script>${ZOOM_PAGE_SCRIPT}</script>
</body>
</html>`;
