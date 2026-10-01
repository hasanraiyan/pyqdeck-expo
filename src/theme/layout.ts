// Pure layout rules shared by useResponsive() and the navigation shell.
// Deliberately free of react-native imports so it can be unit-tested with
// plain node (see layout.test.ts) and reused anywhere a width is available.
// Spec: docs/SRS-responsive-ui-migration.md (sections 4 and 5).

export const BREAKPOINTS = { tablet: 600, laptop: 1024, desktop: 1440 } as const;

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

/**
 * Per-breakpoint values. Only `phone` is required; the rest cascade upward,
 * so `{ phone: 2, laptop: 4 }` means 2 on phone AND tablet, 4 from laptop up.
 */
export interface BreakpointValues<T> {
  phone: T;
  tablet?: T;
  laptop?: T;
  desktop?: T;
}

/** The one definition of window class. Width only: orientation and device type never override it (BP-1). */
export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.laptop) return 'laptop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

// `??` rather than `||` so a deliberate `false` / `0` at one breakpoint isn't
// silently replaced by the smaller breakpoint's value.
export function pickByBreakpoint<T>(breakpoint: Breakpoint, values: BreakpointValues<T>): T {
  if (breakpoint === 'desktop') return values.desktop ?? values.laptop ?? values.tablet ?? values.phone;
  if (breakpoint === 'laptop') return values.laptop ?? values.tablet ?? values.phone;
  if (breakpoint === 'tablet') return values.tablet ?? values.phone;
  return values.phone;
}

/** Layout tokens per breakpoint. Screens read these instead of hard-coding numbers (BP-5). */
export const LAYOUT = {
  /** Page gutter. */
  gutter: { phone: 16, tablet: 24, laptop: 32, desktop: 40 },
  /** Index and grid screens: wide is the point. */
  wideMaxWidth: { phone: 720, tablet: 900, laptop: 1100, desktop: 1240 },
  /** Prose and forms: keeps lines near 45-80 characters. */
  readMaxWidth: { phone: 720, tablet: 680, laptop: 720, desktop: 760 },
  /** Width of the left rail / sidebar (the phone bottom bar has none). */
  shellWidth: { rail: 72, sidebar: 240 },
  /** Master-detail pane sizes, used from Phase 3. */
  pane: { listMin: 320, detailMin: 480, list: { laptop: 360, desktop: 400 } },
} as const;

export type ShellMode = 'bottom' | 'rail' | 'sidebar';

/** Navigation shell for a window class: bottom bar, 72 px rail, or labelled sidebar (FR-N1). */
export function getShellMode(breakpoint: Breakpoint): ShellMode {
  if (breakpoint === 'phone') return 'bottom';
  if (breakpoint === 'tablet') return 'rail';
  return 'sidebar';
}

/** Width taken by the shell, or 0 for the bottom bar. A collapsed sidebar is the rail width (FR-N5). */
export function getShellWidth(mode: ShellMode, collapsed = false): number {
  if (mode === 'bottom') return 0;
  if (mode === 'rail' || collapsed) return LAYOUT.shellWidth.rail;
  return LAYOUT.shellWidth.sidebar;
}

/**
 * Column count for a grid, from the *measured container* width (BP-3), so it
 * stays right beside a sidebar and on web where the scrollbar eats width.
 * Never returns less than 1 or more than `maxColumns`.
 */
export function getGridColumns(
  containerWidth: number,
  {
    minCardWidth,
    gap = 12,
    maxColumns = 6,
    allowedColumns,
  }: { minCardWidth: number; gap?: number; maxColumns?: number; allowedColumns?: number[] }
): number {
  if (!(containerWidth > 0) || !(minCardWidth > 0)) return allowedColumns?.length ? Math.min(...allowedColumns) : 1;
  const fit = Math.max(1, Math.min(maxColumns, Math.floor((containerWidth + gap) / (minCardWidth + gap))));
  if (!allowedColumns?.length) return fit;
  // Only some counts tile cleanly (e.g. 4 cards: 2 or 4, never 3 with an orphan):
  // take the largest allowed count that fits, else the smallest allowed.
  const fitting = allowedColumns.filter((c) => c <= fit);
  return fitting.length ? Math.max(...fitting) : Math.min(...allowedColumns);
}

/** Card width for `columns` columns across `containerWidth`, gaps included. */
export function getCardWidth(containerWidth: number, columns: number, gap = 12): number {
  const cols = Math.max(1, columns);
  return (containerWidth - gap * (cols - 1)) / cols;
}

/**
 * Two panes only when each can hold its minimum width (BP-4) and the window
 * is at least tablet class. `shellWidth` is what the rail / sidebar already
 * takes from the window.
 */
export function canShowTwoPanes(width: number, shellWidth: number): boolean {
  if (getBreakpoint(width) === 'phone') return false;
  return width - shellWidth >= LAYOUT.pane.listMin + LAYOUT.pane.detailMin;
}
