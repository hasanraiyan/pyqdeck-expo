import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAKPOINTS,
  getBreakpoint,
  pickByBreakpoint,
  getShellMode,
  getGridColumns,
  getCardWidth,
  canShowTwoPanes,
  canShowTwoPanesIn,
  getListPaneWidth,
  getShellWidth,
  LAYOUT,
} from './layout.ts';

test('getBreakpoint uses 600 / 1024 / 1440 thresholds', () => {
  assert.equal(getBreakpoint(360), 'phone');
  assert.equal(getBreakpoint(BREAKPOINTS.tablet - 1), 'phone');
  assert.equal(getBreakpoint(BREAKPOINTS.tablet), 'tablet');
  assert.equal(getBreakpoint(BREAKPOINTS.laptop - 1), 'tablet');
  assert.equal(getBreakpoint(BREAKPOINTS.laptop), 'laptop');
  assert.equal(getBreakpoint(BREAKPOINTS.desktop - 1), 'laptop');
  assert.equal(getBreakpoint(1920), 'desktop');
});

test('pickByBreakpoint cascades upward and keeps falsy values', () => {
  const v = { phone: 2, laptop: 4 };
  assert.equal(pickByBreakpoint('phone', v), 2);
  assert.equal(pickByBreakpoint('tablet', v), 2);
  assert.equal(pickByBreakpoint('laptop', v), 4);
  assert.equal(pickByBreakpoint('desktop', v), 4);
  assert.equal(pickByBreakpoint('desktop', { phone: true, laptop: false }), false);
});

test('shell mode follows window class', () => {
  assert.equal(getShellMode('phone'), 'bottom');
  assert.equal(getShellMode('tablet'), 'rail');
  assert.equal(getShellMode('laptop'), 'sidebar');
  assert.equal(getShellMode('desktop'), 'sidebar');
});

test('getGridColumns is bounded and uses container width', () => {
  const opts = { minCardWidth: 150, gap: 12, maxColumns: 4 };
  assert.equal(getGridColumns(0, opts), 1);
  assert.equal(getGridColumns(100, opts), 1);
  assert.equal(getGridColumns(330, opts), 2);
  assert.equal(getGridColumns(640, opts), 4);
  assert.equal(getGridColumns(2000, opts), 4);
});

test('getCardWidth accounts for gaps', () => {
  assert.equal(getCardWidth(612, 4, 12), 144);
  assert.equal(getCardWidth(300, 1, 12), 300);
});

test('two panes need both minimum widths beside the shell, and not on phone', () => {
  assert.equal(canShowTwoPanes(500, 0), false);
  assert.equal(canShowTwoPanes(768, LAYOUT.shellWidth.rail), false);
  assert.equal(canShowTwoPanes(840, LAYOUT.shellWidth.rail), false);
  assert.equal(canShowTwoPanes(900, LAYOUT.shellWidth.rail), true);
  assert.equal(canShowTwoPanes(1280, LAYOUT.shellWidth.sidebar), true);
});

test('shell width: none on phone, rail on tablet, sidebar collapses to rail', () => {
  assert.equal(getShellWidth('bottom'), 0);
  assert.equal(getShellWidth('bottom', true), 0);
  assert.equal(getShellWidth('rail'), LAYOUT.shellWidth.rail);
  assert.equal(getShellWidth('sidebar'), LAYOUT.shellWidth.sidebar);
  assert.equal(getShellWidth('sidebar', true), LAYOUT.shellWidth.rail);
});

test('getGridColumns honours allowedColumns (no orphan rows)', () => {
  const opts = { minCardWidth: 148, gap: 12, allowedColumns: [2, 4] };
  assert.equal(getGridColumns(358, opts), 2);
  assert.equal(getGridColumns(600, opts), 2);
  assert.equal(getGridColumns(640, opts), 4);
  assert.equal(getGridColumns(0, opts), 2);
  assert.equal(getGridColumns(100, opts), 2);
});

test('two panes from measured container width', () => {
  assert.equal(canShowTwoPanesIn(799), false);
  assert.equal(canShowTwoPanesIn(800), true);
});

test('list pane width by window class', () => {
  assert.equal(getListPaneWidth('phone'), 320);
  assert.equal(getListPaneWidth('tablet'), 320);
  assert.equal(getListPaneWidth('laptop'), 360);
  assert.equal(getListPaneWidth('desktop'), 400);
});
