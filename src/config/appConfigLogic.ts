/**
 * Pure logic for the remote app config (docs/SRS-admin-features.md, 3.4): version
 * comparison and defensive parsing. No storage or network imports, so it runs
 * under `node --test`.
 */

/** How the app batches its sync requests; tuned from the server (SRS-event-driven-architecture). */
export interface SyncHints {
  /** Smallest gap between two rounds started by lifecycle events alone. */
  minRoundGapMs: number;
  /** How long events arriving together are folded into one round. */
  mergeWindowMs: number;
}

export const DEFAULT_SYNC_HINTS: SyncHints = { minRoundGapMs: 3000, mergeWindowMs: 400 };

/** The same bounds the server enforces (appConfigService.js SYNC_HINT_BOUNDS). */
export const SYNC_HINT_BOUNDS = {
  minRoundGapMs: [1000, 300_000],
  mergeWindowMs: [100, 2000],
} as const;

/** Whatever came from the server, made safe: a bad value falls back to the default. */
export function clampSyncHints(raw: unknown): SyncHints {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (name: keyof SyncHints): number => {
    const v = r[name];
    const [lo, hi] = SYNC_HINT_BOUNDS[name];
    if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SYNC_HINTS[name];
    return Math.min(hi, Math.max(lo, Math.round(v)));
  };
  return { minRoundGapMs: pick('minRoundGapMs'), mergeWindowMs: pick('mergeWindowMs') };
}

export interface AppConfig {
  minAppVersion: string;
  recommendedAppVersion: string;
  banner: { message: string; level: 'info' | 'warning'; id: string };
  flags: { syncEnabled: boolean; settingsSyncEnabled: boolean; nudgesEnabled: boolean; adsEnabled: boolean };
  syncHints: SyncHints;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  minAppVersion: '',
  recommendedAppVersion: '',
  banner: { message: '', level: 'info', id: '' },
  flags: { syncEnabled: true, settingsSyncEnabled: true, nudgesEnabled: true, adsEnabled: true },
  syncHints: DEFAULT_SYNC_HINTS,
};

const SEMVER = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/** [major, minor, patch], or null when it is not a plain x.y.z version. */
export function parseVersion(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = SEMVER.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Is `current` older than `required`? An unparseable or empty value on either
 * side means "no requirement" (false) - a bad config must never lock students
 * out of the app.
 */
export function isVersionBelow(current: string, required: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(required);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Turns whatever the server (or storage) returned into a safe config. Every
 * field falls back to its default on a wrong type, so garbage can switch
 * nothing off and block nothing (ADM-FR-30).
 */
export function sanitizeAppConfig(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const version = (v: unknown) => (parseVersion(v) ? (v as string).trim() : '');
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : true);
  const b = (r.banner && typeof r.banner === 'object' ? r.banner : {}) as Record<string, any>;
  const f = (r.flags && typeof r.flags === 'object' ? r.flags : {}) as Record<string, any>;
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 200) : '';
  return {
    minAppVersion: version(r.minAppVersion),
    recommendedAppVersion: version(r.recommendedAppVersion),
    banner: {
      message,
      level: b.level === 'warning' ? 'warning' : 'info',
      id: typeof b.id === 'string' ? b.id.slice(0, 40) : '',
    },
    flags: {
      syncEnabled: bool(f.syncEnabled),
      settingsSyncEnabled: bool(f.settingsSyncEnabled),
      nudgesEnabled: bool(f.nudgesEnabled),
      adsEnabled: bool(f.adsEnabled),
    },
    syncHints: clampSyncHints(r.syncHints),
  };
}

/** What the running app should do given the config and its own version. */
export function updateStatus(
  config: AppConfig,
  currentVersion: string
): 'required' | 'recommended' | 'ok' {
  if (isVersionBelow(currentVersion, config.minAppVersion)) return 'required';
  if (isVersionBelow(currentVersion, config.recommendedAppVersion)) return 'recommended';
  return 'ok';
}
