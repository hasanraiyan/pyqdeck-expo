/**
 * Pure logic for the remote app config (docs/SRS-admin-features.md, 3.4): version
 * comparison and defensive parsing. No storage or network imports, so it runs
 * under `node --test`.
 */

export interface AppConfig {
  minAppVersion: string;
  recommendedAppVersion: string;
  banner: { message: string; level: 'info' | 'warning'; id: string };
  flags: { syncEnabled: boolean; settingsSyncEnabled: boolean; nudgesEnabled: boolean };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  minAppVersion: '',
  recommendedAppVersion: '',
  banner: { message: '', level: 'info', id: '' },
  flags: { syncEnabled: true, settingsSyncEnabled: true, nudgesEnabled: true },
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
    },
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
