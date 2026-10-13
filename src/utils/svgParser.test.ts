import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSvgDimensions,
  extractSvgTitle,
  parseSvgContent,
  RAW_SVG_REGEX,
  sanitizeSvgForNative,
} from './svgParser.ts';

test('extractSvgDimensions extracts ratio from viewBox', () => {
  const xml = '<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"></svg>';
  const { aspectRatio, width, height } = extractSvgDimensions(xml);
  assert.equal(width, 400);
  assert.equal(height, 200);
  assert.equal(aspectRatio, 2);
});

test('extractSvgDimensions extracts ratio from width and height attributes', () => {
  const xml = '<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"></svg>';
  const { aspectRatio, width, height } = extractSvgDimensions(xml);
  assert.equal(width, 300);
  assert.equal(height, 150);
  assert.equal(aspectRatio, 2);
});

test('extractSvgTitle extracts title tag', () => {
  const xml = '<svg><title>Logic Gate Diagram</title><circle cx="10" cy="10" r="5" /></svg>';
  const title = extractSvgTitle(xml);
  assert.equal(title, 'Logic Gate Diagram');
});

test('parseSvgContent parses clean SVG block', () => {
  const raw = `
<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="red" />
</svg>
`;
  const data = parseSvgContent(raw, 'Circle Test');
  assert.ok(data);
  assert.equal(data.title, 'Circle Test');
  assert.equal(data.aspectRatio, 1);
  assert.ok(data.xml.startsWith('<svg'));
  assert.ok(data.xml.endsWith('</svg>'));
});

test('RAW_SVG_REGEX matches standalone svg blocks', () => {
  const doc = `
# Topic Heading
<svg viewBox="0 0 200 100"><rect width="100" height="50"/></svg>
Some text
<svg viewBox="0 0 300 150"><circle cx="10" cy="10" r="5"/></svg>
`;
  const matches = [...doc.matchAll(RAW_SVG_REGEX)];
  assert.equal(matches.length, 2);
});

test('sanitizeSvgForNative drops turbulence filters but keeps cheap ones', () => {
  const xml =
    "<svg><defs><filter id='w'><feTurbulence type='fractalNoise'/><feDisplacementMap in='SourceGraphic'/></filter>" +
    "<filter id='s'><feDropShadow dx='1'/></filter></defs>" +
    "<rect filter='url(#w)'/><rect filter=\"url(#s)\"/></svg>";
  const out = sanitizeSvgForNative(xml);
  assert.ok(!out.includes('feTurbulence'));
  assert.ok(!out.includes('url(#w)'));
  assert.ok(out.includes('<filter id=\'s\'>'));
  assert.ok(out.includes('url(#s)'));
});

test('sanitizeSvgForNative never leaves a raw < inside text nodes', () => {
  const out = sanitizeSvgForNative('<svg><text x="1">SIFS &lt; PIFS &lt; DIFS &amp; more</text></svg>');
  assert.ok(!/>[^<]*<[^/!?a-zA-Z][^<]*</.test(out));
  assert.ok(out.includes('>SIFS ﹤ PIFS ﹤ DIFS & more<'));
});

test('sanitizeSvgForNative maps classes to fonts and decodes entities', () => {
  const xml =
    '<svg><style>@import url(x);</style><text class="cnx-hdr" x="1">DNS &amp; DDNS</text>' +
    '<text class="cnx-body">a</text><marker orient="auto-start-reverse"/></svg>';
  const out = sanitizeSvgForNative(xml);
  assert.ok(out.includes('font-family="Kalam_700Bold"'));
  assert.ok(out.includes('font-family="PatrickHand_400Regular"'));
  assert.ok(out.includes('>DNS & DDNS<'));
  assert.ok(!out.includes('<style'));
  assert.ok(out.includes('orient="auto"'));
});
