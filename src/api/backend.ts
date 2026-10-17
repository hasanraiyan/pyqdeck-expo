// Backend origin configuration for PYQDeck.
// The app connects to the primary API origin: https://api.pyqdeck.in
// See /api/ping in the server repo (server/server.js).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit, on } from '../events/bus';

export type OriginId = 'api';

type Origin = {
  id: OriginId;
  label: string;
  root: string;
};

const ORIGINS: Origin[] = [
  { id: 'api', label: 'API', root: 'https://api.pyqdeck.in' },
];

const DEFAULT_ORIGIN = ORIGINS[0];

const PING_TIMEOUT_MS = 4000;

// How stale a selection has to be before returning from background re-runs
// it. Short enough to recover after an outage, long enough that tabbing away
// for a few seconds costs nothing.
const RESUME_RECHECK_AFTER_MS = 5 * 60 * 1000;

let active: Origin = DEFAULT_ORIGIN;

// Dev-only manual override set by the debug banner (see
// src/components/BackendDebugBanner.tsx). null = normal auto-selection.
let pinned: OriginId | null = null;

// Lets the debug banner re-render when selection changes. Nothing listens in
// release builds - nothing subscribes outside __DEV__.
function notify(): void {
  emit('backend.changed');
}

// The last origin that proved healthy, remembered across launches so the very
// first request can go straight to it instead of waiting on a health check.
// Deliberately not `pyq_`-prefixed: "Clear cache" must not throw it away.
const ORIGIN_KEY = 'pyqdeck:backend_origin';

// Longest a request will wait for the stored origin to be read. AsyncStorage
// answers in a few ms; the cap only guarantees a slow read can never delay a
// request - it just falls back to the default origin.
const STORED_READ_CAP_MS = 100;

let hasSelected = false;

function persistOrigin(origin: Origin): void {
  AsyncStorage.setItem(ORIGIN_KEY, origin.id).catch(() => {});
}

// Started at import so it is usually finished before the first request.
// Only applies if nothing has selected an origin in the meantime.
const storedRead: Promise<void> = AsyncStorage.getItem(ORIGIN_KEY)
  .then((id) => {
    // If old cached id was ec2 or render, migrate to api
    if (id === 'ec2' || id === 'render') {
      AsyncStorage.setItem(ORIGIN_KEY, 'api').catch(() => {});
    }
    const stored = ORIGINS.find((o) => o.id === id);
    if (stored && !hasSelected && !pinned) active = stored;
  })
  .catch(() => {});

let inFlight: Promise<Origin> | null = null;
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

async function choose(): Promise<Origin> {
  if (pinned) {
    active = ORIGINS.find((o) => o.id === pinned) ?? active;
    lastCheckedAt = Date.now();
    console.log(`[Backend] Pinned to ${active.label} (dev override) - skipping health check`);
    notify();
    return active;
  }

  console.log('[Backend] Health check started');

  if (await ping(DEFAULT_ORIGIN)) {
    active = DEFAULT_ORIGIN;
    lastCheckedAt = Date.now();
    persistOrigin(DEFAULT_ORIGIN);
    console.log(`[Backend] Selected: ${DEFAULT_ORIGIN.label}`);
    notify();
    return DEFAULT_ORIGIN;
  }

  lastCheckedAt = Date.now();
  console.log(`[Backend] Health check failed - staying on ${active.label}`);
  return active;
}

// Collapses concurrent callers onto one health check.
function run(): Promise<Origin> {
  if (inFlight) return inFlight;
  inFlight = choose().finally(() => {
    inFlight = null;
    hasSelected = true;
  });
  return inFlight;
}

// Awaited by every request: resolves with current best guess (the active origin)
// straight away and runs background health check if not yet run.
export async function ready(): Promise<Origin> {
  if (!hasSelected && !inFlight && !pinned) void run();
  if (!hasSelected) {
    await Promise.race([storedRead, new Promise<void>((r) => setTimeout(r, STORED_READ_CAP_MS))]);
  }
  return active;
}

export function getApiBaseUrl(): string {
  return `${active.root}/api/public`;
}

// With a single origin (https://api.pyqdeck.in), failover is a no-op.
export async function failover(attempted: OriginId): Promise<boolean> {
  return false;
}

// Called when the app returns to the foreground.
export function recheckIfStale(): void {
  if (Date.now() - lastCheckedAt < RESUME_RECHECK_AFTER_MS) return;
  void run();
}

// ---------------------------------------------------------------
// Dev-only surface, consumed by src/components/BackendDebugBanner.tsx.
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

export function subscribe(fn: () => void): () => void {
  return on('backend.changed', () => fn());
}

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
