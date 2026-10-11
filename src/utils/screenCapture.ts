/**
 * Guarded access to expo-screen-capture (same pattern as src/utils/mobileAds.ts).
 *
 * The native module may be missing in a binary built before the dependency was
 * added (or on web, which has no such API): a plain import would throw at load
 * time, so the require() itself is guarded. Callers get a working hook on
 * capable builds and a silent no-op elsewhere - the viewer opens either way
 * (docs/SRS-original-paper-viewer.md, FR-PAPER-3).
 */

type Hook = (key?: string) => void;

let usePrevent: Hook | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-screen-capture') as typeof import('expo-screen-capture');
  usePrevent = mod?.usePreventScreenCapture ?? null;
} catch {
  usePrevent = null;
}

const noop: Hook = () => {};

/** Blocks screenshots/recordings while the calling component is mounted. */
export const usePreventScreenCapture: Hook = usePrevent ?? noop;

/** True when capture protection can actually engage on this build. */
export const screenCaptureAvailable = usePrevent !== null;
