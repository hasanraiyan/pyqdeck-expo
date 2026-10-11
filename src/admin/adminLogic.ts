/**
 * Pure helpers for the in-app admin screens (docs/SRS-admin-in-app.md). No
 * React, storage or network imports, so they run under `node --test`.
 */

export interface Grant {
  actions: '*' | string[];
  branches?: '*' | string[];
}
export type Tools = Record<string, Grant>;

/** May this account call `tool` (with `action`, if the tool has actions)? */
export function can(tools: Tools | undefined, tool: string, action?: string): boolean {
  const grant = tools?.[tool];
  if (!grant) return false;
  if (action === undefined || grant.actions === '*') return true;
  return grant.actions.map((a) => a.toLowerCase()).includes(action.toLowerCase());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits pasted text (commas, spaces, new lines) into unique, valid emails. */
export function parseEmails(text: string): { emails: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (EMAIL.test(t)) seen.add(t);
    else invalid.push(raw.trim());
  }
  return { emails: [...seen], invalid };
}

export interface NotifyInput {
  title: string;
  body: string;
  audience: 'all' | 'signed_in' | 'signed_out' | 'beta';
  emails: string[];
}

export function validateNotify(i: NotifyInput): string | null {
  if (!i.title.trim()) return 'Add a title.';
  if (i.title.length > 80) return 'The title is at most 80 characters.';
  if (!i.body.trim()) return 'Add a message.';
  if (i.body.length > 180) return 'The message is at most 180 characters.';
  if (i.emails.length > 200) return 'At most 200 emails per send.';
  return null;
}

/**
 * A fingerprint of everything that decides who gets what. Send is allowed only
 * when the fingerprint of the current form equals the one that was previewed, so
 * editing anything after a preview forces another preview.
 */
export function notifyFingerprint(i: NotifyInput): string {
  return JSON.stringify([
    i.title.trim(),
    i.body.trim(),
    i.emails.length > 0 ? 'named' : i.audience,
    [...i.emails].sort(),
  ]);
}

export function canSend(current: NotifyInput, previewed: string | null): boolean {
  return validateNotify(current) === null && previewed === notifyFingerprint(current);
}

export interface ConfigDraft {
  minAppVersion: string;
  recommendedAppVersion: string;
  bannerMessage: string;
  bannerLevel: 'info' | 'warning';
  bannerId: string;
  syncEnabled: boolean;
  settingsSyncEnabled: boolean;
  nudgesEnabled: boolean;
}

const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export function validateConfig(d: ConfigDraft): string | null {
  for (const [label, v] of [
    ['Minimum version', d.minAppVersion],
    ['Recommended version', d.recommendedAppVersion],
  ] as const) {
    if (v.trim() && !SEMVER.test(v.trim())) return `${label} must look like 1.5.0.`;
  }
  if (d.bannerMessage.length > 200) return 'The banner text is at most 200 characters.';
  return null;
}

function below(current: string, required: string): boolean {
  const a = SEMVER.test(current) ? current.split('.').map(Number) : null;
  const b = SEMVER.test(required) ? required.split('.').map(Number) : null;
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Reasons a config save would affect students heavily, to confirm first. */
export function configWarnings(
  before: ConfigDraft,
  after: ConfigDraft,
  installedVersion: string
): string[] {
  const out: string[] = [];
  const min = after.minAppVersion.trim();
  if (min && min !== before.minAppVersion.trim()) {
    out.push(
      below(installedVersion, min)
        ? `Minimum version ${min} is ABOVE the version installed on this phone (${installedVersion}), so this phone will be blocked too.`
        : `Every app older than ${min} will be blocked behind an "Update required" screen.`
    );
  }
  if (before.syncEnabled && !after.syncEnabled) out.push('Account sync will stop for everyone.');
  if (before.settingsSyncEnabled && !after.settingsSyncEnabled) {
    out.push('Settings and Jump Back In sync will stop for everyone.');
  }
  if (before.nudgesEnabled && !after.nudgesEnabled) out.push('Background sync nudges will stop.');
  return out;
}

/** Only what changed, in the shape PUT /config expects. */
export function configChanges(before: ConfigDraft, after: ConfigDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (after.minAppVersion.trim() !== before.minAppVersion.trim()) {
    out.minAppVersion = after.minAppVersion.trim();
  }
  if (after.recommendedAppVersion.trim() !== before.recommendedAppVersion.trim()) {
    out.recommendedAppVersion = after.recommendedAppVersion.trim();
  }
  if (
    after.bannerMessage.trim() !== before.bannerMessage.trim() ||
    after.bannerLevel !== before.bannerLevel ||
    after.bannerId !== before.bannerId
  ) {
    out.banner = after.bannerMessage.trim()
      ? { message: after.bannerMessage.trim(), level: after.bannerLevel, id: after.bannerId.trim() }
      : null;
  }
  const flags: Record<string, boolean> = {};
  for (const k of ['syncEnabled', 'settingsSyncEnabled', 'nudgesEnabled'] as const) {
    if (after[k] !== before[k]) flags[k] = after[k];
  }
  if (Object.keys(flags).length > 0) out.flags = flags;
  return out;
}

export function configToDraft(c: any): ConfigDraft {
  return {
    minAppVersion: c?.minAppVersion ?? '',
    recommendedAppVersion: c?.recommendedAppVersion ?? '',
    bannerMessage: c?.banner?.message ?? '',
    bannerLevel: c?.banner?.level === 'warning' ? 'warning' : 'info',
    bannerId: c?.banner?.id ?? '',
    syncEnabled: c?.flags?.syncEnabled !== false,
    settingsSyncEnabled: c?.flags?.settingsSyncEnabled !== false,
    nudgesEnabled: c?.flags?.nudgesEnabled !== false,
  };
}
