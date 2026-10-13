// Temporary launch-time logs. Filter Metro / logcat output by "[STARTUP]".
// Times are ms since this file was first evaluated (the bundle entry, +0ms), so the
// gap between "bundle entry" and "all modules evaluated" is how long loading all
// the modules takes. Remove once startup has been measured.
const nowMs = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const t0 = nowMs();

export function startupMark(label: string) {
  console.log(`[STARTUP] +${Math.round(nowMs() - t0)}ms ${label}`);
}

startupMark('bundle entry (first module evaluated)');

try {
  // React Native's own native-side launch marks, when this build exposes them.
  const t = (globalThis as any).performance?.rnStartupTiming;
  if (t) console.log(`[STARTUP] native timing ${JSON.stringify(t)}`);
} catch {}
