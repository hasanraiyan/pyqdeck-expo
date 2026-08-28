// Picks which backend origin the app talks to. Two deployments run identical
// code - EC2 (primary) and Render (backup) - and either can be down
// independently, so the client decides at runtime rather than relying on DNS
// or a load balancer. See /api/ping in the server repo (server/server.js).
//
// Deliberately client-side for now: at this traffic level a gateway or
// Cloudflare load balancer is more infrastructure than the app needs, and
// this whole file can be deleted the day that changes - nothing outside
// src/api/index.ts imports it.

export type OriginId = 'ec2' | 'render';

type Origin = {
  id: OriginId;
  label: string;
  root: string;
};

// Order is the preference order. EC2 first: it's the box we control and pay
// for directly, Render is the safety net.
const ORIGINS: Origin[] = [
  { id: 'ec2', label: 'EC2', root: 'https://ec2-api.pyqdeck.in' },
  { id: 'render', label: 'Render', root: 'https://api.pyqdeck.in' },
];

const RENDER = ORIGINS[1];

// The 'EC2 is too slow, use Render instead' threshold - failing over on
// slowness, not just on hard failure, is the whole point of the budget.
//
// Sized from measured round trips (Aug 2026, IN -> both origins): warm, EC2
// and Render are identical at ~330ms; cold, EC2 took 3541ms and Render
// 1879ms. Nearly all of that cold cost is DNS + TLS handshake, which *both*
// origins pay, so a tighter budget would abandon EC2 over a one-time
// handshake and hand traffic to a Render that is no faster once warm. 4s
// clears the measured cold path with headroom while still capping how long a
// genuinely wedged origin can stall the first screen.
const PING_TIMEOUT_MS = 4000;

// How stale a selection has to be before returning from background re-runs
// it. Short enough to climb back onto EC2 after an outage, long enough that
// tabbing away for a few seconds costs nothing.
const RESUME_RECHECK_AFTER_MS = 5 * 60 * 1000;

// Render, not EC2, is the pre-selection default: it's what the app shipped
// with before this file existed, so if selection somehow never runs the
// behaviour is exactly today's. Every request awaits ready() first, so this
// value is only ever used if the health check itself fails to run.
let active: Origin = RENDER;

// Dev-only manual override set by the debug banner (see
// src/components/BackendDebugBanner.tsx). null = normal auto-selection.
let pinned: OriginId | null = null;

// Lets the debug banner re-render when selection changes. Empty in release
// builds - nothing subscribes outside __DEV__.
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

let inFlight: Promise<Origin> | null = null;
let hasSelected = false;
let lastCheckedAt = 0;

// True only for a backend that answered in time, with a success status, a
// parseable body, and status === 'ok'. A degraded origin (Mongo down) answers
// 503 with status 'degraded' and is correctly rejected here - that's the
// whole reason /api/ping reports readyState instead of just being a 200.
async function ping(origin: Origin): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(`${origin.root}/api/ping`, {
      signal: controller.signal,
      // The origin already sends Cache-Control: no-store, but Cloudflare
      // fronts both hosts and the platform HTTP cache sits in front of that -
      // a stale probe would happily vouch for a dead box.
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      console.log(`[Backend] ${origin.label}: unhealthy (HTTP ${res.status})`);
      return false;
    }

    const body = await res.json();
    const healthy = body?.status === 'ok';
    console.log(
      `[Backend] ${origin.label}:\n  URL: ${origin.root}/api/ping\n` +
        `  Status: ${healthy ? 'healthy' : 'unhealthy'}\n  Origin: ${body?.origin ?? 'unknown'}`
    );
    return healthy;
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? `timeout after ${PING_TIMEOUT_MS}ms` : err?.message;
    console.log(`[Backend] ${origin.label} health check failed: ${reason}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Walks ORIGINS in preference order and stops at the first healthy one, so a
// healthy EC2 means Render is never contacted - that's the "don't ping both
// servers constantly" requirement, handled by construction rather than by a
// scheduler.
async function choose(): Promise<Origin> {
  // A pinned origin is held even when it is unhealthy: the point of pinning
  // is to watch a specific backend fail, and auto-selection would helpfully
  // undo the experiment.
  if (pinned) {
    active = ORIGINS.find((o) => o.id === pinned) ?? active;
    lastCheckedAt = Date.now();
    console.log(`[Backend] Pinned to ${active.label} (dev override) - skipping health check`);
    notify();
    return active;
  }

  console.log('[Backend] Health check started');

  for (const origin of ORIGINS) {
    if (await ping(origin)) {
      active = origin;
      lastCheckedAt = Date.now();
      console.log(`[Backend] Selected: ${origin.label}`);
      notify();
      return origin;
    }
  }

  // Both unreachable. Keep whatever was active rather than blanking it: the
  // device is most likely offline, and the read paths in index.ts serve their
  // SQLite cache off the resulting error. When connectivity returns, the next
  // failed request re-runs this.
  lastCheckedAt = Date.now();
  console.log(`[Backend] No backend available - staying on ${active.label}`);
  return active;
}

// Collapses concurrent callers onto one health check. Without this, a screen
// firing four parallel requests into a dead origin would start four probe
// storms at once.
function run(): Promise<Origin> {
  if (inFlight) return inFlight;
  inFlight = choose().finally(() => {
    inFlight = null;
    hasSelected = true;
  });
  return inFlight;
}

// Awaited by every request. The first call kicks off selection; later calls
// are free. Startup cost is one ping RTT on the first request only, and it
// overlaps app boot (fonts, ads init, navigation) rather than adding to it.
export function ready(): Promise<Origin> {
  return hasSelected ? Promise.resolve(active) : run();
}

export function getApiBaseUrl(): string {
  return `${active.root}/api/public`;
}

// Re-runs selection after a request failed. Returns true only if that landed
// on a *different* origin - the caller uses it to decide whether retrying is
// worth anything. If the active origin still probes healthy the request
// failed for its own reasons and retrying it elsewhere would just double the
// failure.
export async function failover(): Promise<boolean> {
  const previous = active.id;
  await run();
  const switched = active.id !== previous;
  if (switched) console.log(`[Backend] Switched: ${previous} -> ${active.id}`);
  return switched;
}

// Called when the app returns to the foreground, so a session that fell back
// to Render climbs back onto EC2 once it recovers.
export function recheckIfStale(): void {
  if (Date.now() - lastCheckedAt < RESUME_RECHECK_AFTER_MS) return;
  void run();
}

// ---------------------------------------------------------------
// Dev-only surface, consumed by src/components/BackendDebugBanner.tsx.
// These stay in the release bundle (Metro does not tree-shake), but the
// banner is never mounted there and setPinned() no-ops on !__DEV__, so a
// shipped build can never leave auto-selection.
// ---------------------------------------------------------------

export type BackendState = {
  id: OriginId;
  label: string;
  root: string;
  pinned: boolean;
};

export function getState(): BackendState {
  return { id: active.id, label: active.label, root: active.root, pinned: pinned !== null };
}

export function listOrigins(): ReadonlyArray<{ id: OriginId; label: string }> {
  return ORIGINS.map((o) => ({ id: o.id, label: o.label }));
}

// Subscribe to selection changes so the banner re-renders when auto-selection
// resolves or a failover switches origins. Returns an unsubscribe function.
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Pin to one origin (or pass null to hand control back to auto-selection).
// No-op outside __DEV__ so a stray call can never strand a shipped build on
// one backend.
export function setPinned(id: OriginId | null): void {
  if (!__DEV__) return;

  pinned = id;

  if (id === null) {
    console.log('[Backend] Unpinned - resuming auto selection');
    hasSelected = false;
    void run();
    return;
  }

  active = ORIGINS.find((o) => o.id === id) ?? active;
  hasSelected = true;
  console.log(`[Backend] Pinned: ${active.label} (${active.root})`);
  notify();
}
