import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { ApiError, syncAll, type ProgressSyncResponse } from '../api';
import {
  applyPulledItems,
  getAllProgress,
  loadOutbox,
  migrateProgressV1,
  queueOps,
  setLocalChangeHandler,
  updateOutbox,
} from './syllabusProgress';
import {
  backoffMs,
  batches,
  canSync,
  nextSendDelay,
  planFirstPush,
  settle,
  type OutboxOp,
  type RemoteItem,
} from './progressLogic';
import { OWNER_KEY } from './storageRegistry';
import { applyAuxResponse, buildAuxRequest, type AuxSent } from './settingsSync';
import { readPendingSettings } from './settingsPending';
import { setSettingChangeHandler } from './settingsPending';
import { registerWipeHook, wipeUserData } from '../auth/wipeUserData';
import { isAuthEnabled } from '../config/features';
import { getSignedInUserId } from '../auth/token';
import { getKnownPushToken } from '../utils/notifications';

/**
 * Account-backed progress sync engine (see docs/SRS-account-progress-sync-*).
 *
 * Local-first: ticks are written by syllabusProgress.ts and queued in an
 * outbox; this engine sends the outbox to /api/me/progress/sync and pulls what
 * other devices changed. It never blocks a tap - everything here runs after
 * the local write - and a failure only ever leaves the outbox in place.
 */

const CURSOR_KEY = 'pyqdeck:progress_cursor';
const LAST_SYNC_KEY = 'pyqdeck:last_sync_at';
const SYNC_ENABLED_KEY = 'pyqdeck:sync_enabled';
const BATCH_SIZE = 200;
const DEBOUNCE_MS = 2_000;
const MAX_WAIT_MS = 30_000;
let firstQueuedAt = 0;
const TAB_OPEN_MIN_GAP_MS = 60_000;
const AUX_SYNC_MIN_GAP_MS = 60_000;
let lastAuxSyncAt = 0;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'paused' | 'error' | 'off';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
}

let session: { signedIn: boolean; userId: string | null } = { signedIn: false, userId: null };
let syncEnabled = true;
let status: SyncStatus = { state: 'idle', pending: 0, lastSyncAt: null };
let inFlight: Promise<void> | null = null;
let rerun = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let pausedForAuth = false;
let quotaBlocked = false;
let lastTabTrigger = 0;
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function refreshPending() {
  const pending = Object.keys(await loadOutbox()).length;
  setStatus({ pending });
  return pending;
}

async function isOnline(): Promise<boolean> {
  try {
    const net = await Network.getNetworkStateAsync();
    return net.isConnected !== false && net.isInternetReachable !== false;
  } catch {
    return true; // unknown: let the request itself decide
  }
}

const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};

/**
 * Schedules a sync. Events (a tick, a setting change, a recent, coming back
 * online) are coalesced: each one pushes the send back by the debounce, but
 * never past MAX_WAIT_MS after the first one, so a steady stream of changes
 * still goes out regularly. `immediate` flushes now.
 */
export function requestSync(opts: { immediate?: boolean; delayMs?: number } = {}): void {
  if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, syncEnabled, online: true })) {
    return;
  }
  const now = Date.now();
  if (timer === null) firstQueuedAt = now;
  clearTimer();
  const debounce = opts.immediate ? 0 : (opts.delayMs ?? DEBOUNCE_MS);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, nextSendDelay(now, firstQueuedAt, debounce, MAX_WAIT_MS));
}

/** Study tab opened: sync at most once a minute. */
export function requestSyncOnStudyOpen(): void {
  const now = Date.now();
  if (now - lastTabTrigger < TAB_OPEN_MIN_GAP_MS) return;
  lastTabTrigger = now;
  requestSync({ immediate: true });
}

export async function loadSyncEnabled(): Promise<boolean> {
  try {
    syncEnabled = (await AsyncStorage.getItem(SYNC_ENABLED_KEY)) !== '0';
  } catch {
    syncEnabled = true;
  }
  setStatus({ state: syncEnabled ? status.state : 'off' });
  return syncEnabled;
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  syncEnabled = enabled;
  try {
    await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled ? '1' : '0');
  } catch {}
  if (!enabled) {
    clearTimer();
    setStatus({ state: 'off' });
  } else {
    setStatus({ state: 'idle' });
    requestSync({ immediate: true });
  }
}

export function isSyncEnabled(): boolean {
  return syncEnabled;
}

/** Called by the auth layer whenever Clerk's signed-in state or user changes. */
export function configureSyncSession(next: { signedIn: boolean; userId: string | null }): void {
  const changedUser = next.userId !== session.userId;
  session = next;
  if (!next.signedIn) {
    clearTimer();
    failures = 0;
    pausedForAuth = false;
    quotaBlocked = false;
    return;
  }
  if (changedUser) {
    pausedForAuth = false;
    failures = 0;
    quotaBlocked = false;
  }
  void loadSyncEnabled().then(() => requestSync({ immediate: true }));
}

/** Waits (up to `timeoutMs`) for the outbox to drain. True if it is empty. */
export async function flushOutbox(timeoutMs: number): Promise<boolean> {
  if ((await refreshPending()) === 0) return true;
  if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, syncEnabled, online: await isOnline() })) {
    return false;
  }
  await Promise.race([syncNow(), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
  return (await refreshPending()) === 0;
}

export function pendingCount(): Promise<number> {
  return refreshPending();
}

const newOpId = () => Crypto.randomUUID();

async function runRound(): Promise<void> {
  const userId = session.userId;
  if (!userId) return;

  // A different account than the one whose data is on this device: that data
  // must not be merged into this account (AND-FR-24).
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (owner && owner !== userId) await wipeUserData('owner-mismatch');
  await migrateProgressV1();

  // Settings and Jump Back In ride on the FIRST request of the round, so a round
  // is one request. They are included when something changed locally or at most
  // once a minute otherwise (a quiet round pulls nothing extra).
  let aux: AuxSent | null = null;
  const pendingNow = (await readPendingSettings()).size > 0;
  if (pendingNow || Date.now() - lastAuxSyncAt > AUX_SYNC_MIN_GAP_MS) {
    aux = await buildAuxRequest();
    lastAuxSyncAt = Date.now();
  }
  let needsAnotherRound = false;

  const call = async (
    cursor: string | null,
    ops: OutboxOp[]
  ): Promise<ProgressSyncResponse> => {
    const sentAux = aux;
    aux = null; // only the first request of the round carries it
    const res = await syncAll({
      progress: { cursor, ops, limit: 1000 },
      ...(sentAux ? sentAux.request : {}),
      ...(getKnownPushToken() ? { device: { pushToken: getKnownPushToken() as string } } : {}),
    });
    if (sentAux) {
      try {
        const applied = await applyAuxResponse(sentAux, res);
        needsAnotherRound ||= applied.needsAnotherRound;
      } catch {
        // Settings/recents are secondary: never fail the progress round.
      }
    }
    return res.progress;
  };

  let cursor = await AsyncStorage.getItem(CURSOR_KEY);
  let didFirstSync = false;

  if (cursor === null) {
    didFirstSync = true;
    // First sync for this account on this device: pull everything first, then
    // merge, then push what the server lacks (AND-FR-17/18).
    const local = await getAllProgress();
    const items: RemoteItem[] = [];
    let page = await call(null, []);
    items.push(...page.items);
    while (page.hasMore) {
      page = await call(page.cursor, []);
      items.push(...page.items);
    }
    const toPush = planFirstPush(local, items, newOpId);
    await applyPulledItems(items);
    await queueOps(toPush);
    await AsyncStorage.setItem(OWNER_KEY, userId);
    await AsyncStorage.setItem(CURSOR_KEY, page.cursor);
    cursor = page.cursor;
  }

  // Push the outbox in batches, pulling whatever changed after each. With an
  // empty outbox this is exactly one request (and it was the first one above on
  // a first sync, otherwise this one).
  for (let round = 0; round < 50; round++) {
    const all = Object.values(await loadOutbox());
    const [batch] = batches(all, BATCH_SIZE);
    const sendable = quotaBlocked ? [] : (batch ?? []);
    // A first sync already used its request for the aux sections; when there is
    // nothing to push either, the pull-only call below would be a wasted request.
    if (sendable.length === 0 && didFirstSync && round === 0) break;
    const res = await call(cursor, sendable);

    if (sendable.length > 0) {
      // Settled against the live outbox: a tick may have landed mid-request.
      let quota = false;
      await updateOutbox((current) => {
        const settled = settle(current, sendable, res.results);
        quota = settled.quotaExceeded;
        return settled.outbox;
      });
      if (quota) quotaBlocked = true;
    }
    await applyPulledItems(res.items);
    cursor = res.cursor;
    await AsyncStorage.setItem(CURSOR_KEY, cursor);

    // Drain any further pull pages before looking at the outbox again.
    let more = res.hasMore;
    while (more) {
      const next = await call(cursor, []);
      await applyPulledItems(next.items);
      cursor = next.cursor;
      await AsyncStorage.setItem(CURSOR_KEY, cursor);
      more = next.hasMore;
    }

    if (sendable.length === 0) break;
    const left = Object.values(await loadOutbox());
    const progressed = sendable.some((s) => !left.some((o: OutboxOp) => o.opId === s.opId));
    if (left.length === 0 || !progressed) break;
  }

  const now = Date.now();
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
  setStatus({ lastSyncAt: now });

  // A setting or recent changed while the request was in flight, or an account
  // value needs adopting: one more (coalesced) round settles it.
  if (needsAnotherRound) requestSync();
}

/** Runs one sync round (push then pull). Safe to call at any time. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, syncEnabled, online: true })) {
        return;
      }
      if (pausedForAuth) return;
      if (!(await isOnline())) {
        setStatus({ state: 'offline' });
        await refreshPending();
        return;
      }
      setStatus({ state: 'syncing' });
      await runRound();
      failures = 0;
      setStatus({ state: 'idle' });
    } catch (err) {
      const e = err as ApiError;
      if (e?.status === 401) {
        // Session not usable right now. Keep the outbox; never wipe on a 401.
        pausedForAuth = true;
        setStatus({ state: 'paused' });
      } else if (e?.status === 429) {
        const wait = Math.max(1, e.retryAfterSec ?? 60) * 1000;
        setStatus({ state: 'error' });
        clearTimer();
        timer = setTimeout(() => void syncNow(), wait);
      } else {
        setStatus({ state: e?.kind === 'offline' ? 'offline' : 'error' });
        clearTimer();
        timer = setTimeout(() => void syncNow(), backoffMs(failures));
        failures += 1;
      }
    } finally {
      await refreshPending().catch(() => {});
      inFlight = null;
      if (rerun) {
        rerun = false;
        requestSync();
      }
    }
  })();
  return inFlight;
}

/**
 * Runs one sync from the headless background task (a nudge arrived while the app
 * was closed). There is no React tree, so the session is rebuilt from Clerk
 * itself. It only proceeds when Clerk confirms the SAME account whose data is on
 * this device; anything uncertain (not loaded, offline, other account) does
 * nothing, and the next normal app start syncs as usual.
 */
export async function syncFromBackground(): Promise<void> {
  if (!isAuthEnabled) return;
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (!owner) return;
  const userId = await getSignedInUserId();
  if (!userId || userId !== owner) return;
  await loadSyncEnabled();
  session = { signedIn: true, userId };
  await syncNow();
}

/** The sign-in sheet or token refresh resolved: allow syncing again. */
export function resumeAfterAuth(): void {
  pausedForAuth = false;
  requestSync({ immediate: true });
}

// --- wiring ----------------------------------------------------------------

// A local tick schedules a debounced sync.
setLocalChangeHandler(() => {
  void refreshPending();
  requestSync();
});

// A changed account setting schedules a sync (a no-op when signed out).
setSettingChangeHandler(() => requestSync({ immediate: true }));

// Everything in memory that mirrors the removed data is reset with the wipe.
registerWipeHook(() => {
  clearTimer();
  failures = 0;
  pausedForAuth = false;
  quotaBlocked = false;
  lastTabTrigger = 0;
  lastAuxSyncAt = 0;
  setStatus({ state: syncEnabled ? 'idle' : 'off', pending: 0, lastSyncAt: null });
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    if (pausedForAuth) pausedForAuth = false;
    requestSync({ immediate: true });
  } else if (state === 'background') {
    // Going to the background: send what is queued now rather than wait for the
    // debounce, which the OS may never let run.
    if (timer) requestSync({ immediate: true });
  }
});

try {
  Network.addNetworkStateListener((event) => {
    if (event.isConnected && event.isInternetReachable !== false) requestSync({ immediate: true });
  });
} catch {}

void AsyncStorage.getItem(LAST_SYNC_KEY)
  .then((raw) => raw && setStatus({ lastSyncAt: Number(raw) || null }))
  .catch(() => {});
