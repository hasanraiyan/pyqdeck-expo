/**
 * Perspective ("document flatten") math for the paper page editor.
 *
 * The warp itself runs in a hidden WebView canvas (JS only, no native module),
 * so the pixel code lives in WARP_SOURCE as a string. The same string is
 * evaluated by the unit tests, so what is tested is what ships.
 */

export type Pt = { x: number; y: number };
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output rectangle size for a quad: the longer of each pair of opposite edges. */
export const quadOutputSize = (q: Quad, maxSide = 2400) => {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(w, h, 1));
  w *= k;
  h *= k;
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
};

/** True when the quad is convex and non-degenerate (safe to warp). */
export const isValidQuad = (q: Quad): boolean => {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
};

/**
 * Plain-JS source defining `warpPixels(src, sw, sh, quad, ow, oh)`; `src` is
 * RGBA data, `quad` is [[x,y] x4] (TL,TR,BR,BL) in source pixels. Returns a
 * Uint8ClampedArray (ow*oh*4) sampled bilinearly via the destination->source
 * homography (solved with Gaussian elimination).
 */
export const WARP_SOURCE = `
function solveHomography(q, ow, oh) {
  // Map unit-rect corners of the output to the source quad: 8 unknowns.
  var dst = [[0,0],[ow,0],[ow,oh],[0,oh]];
  var A = [], b = [];
  for (var i = 0; i < 4; i++) {
    var x = dst[i][0], y = dst[i][1], u = q[i][0], v = q[i][1];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  var n = 8;
  for (var c = 0; c < n; c++) {
    var p = c;
    for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    var t = A[c]; A[c] = A[p]; A[p] = t;
    var tb = b[c]; b[c] = b[p]; b[p] = tb;
    for (var r2 = c + 1; r2 < n; r2++) {
      var f = A[r2][c] / A[c][c];
      for (var k = c; k < n; k++) A[r2][k] -= f * A[c][k];
      b[r2] -= f * b[c];
    }
  }
  var h = new Array(n);
  for (var r3 = n - 1; r3 >= 0; r3--) {
    var s = b[r3];
    for (var k2 = r3 + 1; k2 < n; k2++) s -= A[r3][k2] * h[k2];
    h[r3] = s / A[r3][r3];
  }
  return h;
}
function warpPixels(src, sw, sh, quad, ow, oh) {
  var h = solveHomography(quad, ow, oh);
  var out = new Uint8ClampedArray(ow * oh * 4);
  for (var y = 0; y < oh; y++) {
    for (var x = 0; x < ow; x++) {
      var d = h[6] * x + h[7] * y + 1;
      var u = (h[0] * x + h[1] * y + h[2]) / d;
      var v = (h[3] * x + h[4] * y + h[5]) / d;
      if (u < 0) u = 0; else if (u > sw - 1) u = sw - 1;
      if (v < 0) v = 0; else if (v > sh - 1) v = sh - 1;
      var x0 = Math.floor(u), y0 = Math.floor(v);
      var x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
      var fx = u - x0, fy = v - y0;
      var i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      var i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      var o = (y * ow + x) * 4;
      for (var ch = 0; ch < 4; ch++) {
        var top = src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx;
        var bot = src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx;
        out[o + ch] = top * (1 - fy) + bot * fy;
      }
    }
  }
  return out;
}
`;

/** Hidden-WebView page: receives {b64, quad, ow, oh}, replies {b64} or {error}. */
export const WARP_HTML = `<!doctype html><html><body><canvas id="c"></canvas><script>
${WARP_SOURCE}
function run(msg) {
  var img = new Image();
  img.onload = function () {
    try {
      var sw = img.naturalWidth, sh = img.naturalHeight;
      var c = document.getElementById('c');
      c.width = sw; c.height = sh;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var src = ctx.getImageData(0, 0, sw, sh).data;
      var out = warpPixels(src, sw, sh, msg.quad, msg.ow, msg.oh);
      c.width = msg.ow; c.height = msg.oh;
      ctx.putImageData(new ImageData(out, msg.ow, msg.oh), 0, 0);
      var url = c.toDataURL('image/jpeg', 0.9);
      window.ReactNativeWebView.postMessage(JSON.stringify({ b64: url.split(',')[1] }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: String(e) }));
    }
  };
  img.onerror = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'image load failed' }));
  };
  img.src = 'data:image/jpeg;base64,' + msg.b64;
}
window.__warp = run;
window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
</script></body></html>`;
