import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { ApiError, syncAll, type ProgressSyncResponse } from '../api';
import {
  applyPulledItems,
  getAllProgress,
  loadOutbox,
  migrateProgressV1,
  queueOps,
  updateOutbox,
} from './syllabusProgress';
import {
  backoffMs,
  batches,
  canSync,
  planFirstPush,
  settle,
  type OutboxOp,
  type RemoteItem,
} from './progressLogic';
import { OWNER_KEY } from './storageRegistry';
import {
  applyAuxResponse,
  buildAuxRequest,
  resetSettingsSyncMemory,
  type AuxSent,
} from './settingsSync';
import { nextFollowUps } from './settingsLogic';
import { readPendingSettings } from './settingsPending';
import { isWipeRunning, registerWipeHook, wipeUserData } from '../auth/wipeUserData';
import { emit, on } from '../events/bus';
import '../events/lifecycle'; // starts the single AppState / Network listener
import type { SyncReason } from '../events/syncPlan';
import { SyncScheduler } from '../events/syncScheduler';
import { isAuthEnabled } from '../config/features';
import { getSignedInUserId } from '../auth/token';
import { getAppConfigNow, loadCachedAppConfig, refreshAppConfig } from '../config/appConfig';
import { getKnownPushToken } from '../utils/notifications';

/**
 * Account-backed progress sync engine (see docs/SRS-account-progress-sync-*).
 *
 * Local-first: ticks are written by syllabusProgress.ts and queued in an
 * outbox; this engine sends the outbox to /api/me/sync and pulls what other
 * devices changed. It never blocks a tap - everything here runs after the local
 * write - and a failure only ever leaves the outbox in place.
 *
 * It is also the sync COORDINATOR (docs/SRS-event-driven-architecture.md, SYN):
 * it listens to facts on the bus (a tick, a setting change, the app waking, the
 * network returning, a nudge from another device), collects them as a reason
 * set, and sends ONE round for the lot - see syncPlan.ts for the timing.
 */

const CURSOR_KEY = 'pyqdeck:progress_cursor';
const LAST_SYNC_KEY = 'pyqdeck:last_sync_at';
const BATCH_SIZE = 200;
// Follow-up rounds in a row since the last real trigger (see requestSync).
let followUps = 0;
const TAB_OPEN_MIN_GAP_MS = 60_000;
const AUX_SYNC_MIN_GAP_MS = 60_000;
let lastAuxSyncAt = 0;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'paused' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
}

let session: { signedIn: boolean; userId: string | null } = { signedIn: false, userId: null };
let status: SyncStatus = { state: 'idle', pending: 0, lastSyncAt: null };
let inFlight: Promise<void> | null = null;
let failures = 0;
// Owns the one pending timer and the reasons waiting for the next round.
const scheduler = new SyncScheduler({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  hints: () => getAppConfigNow().syncHints,
  fire: () => void syncNow(),
});
let pausedForAuth = false;
let quotaBlocked = false;
let lastTabTrigger = 0;

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  emit('sync.status', status);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  return on('sync.status', fn);
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

/**
 * Notes that something wants a sync. Reasons arriving close together share one
 * round (SyncScheduler / syncPlan.ts): the timer is recomputed from the whole
 * set, never past 30 s after the first, and never sooner than a pause the server
 * asked for. While a round is running the reason just waits; the finishing round
 * arms the next one.
 */
function schedule(reason: SyncReason, opts: { delayMs?: number } = {}): void {
  if (isWipeRunning()) return; // the sign-out wipe is removing what a sync would send
  if (!getAppConfigNow().flags.syncEnabled) return; // admin kill switch
  if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, online: true })) {
    return;
  }
  // Anything but the engine's own "one more round" is a real event (a tick, a
  // setting change, the app opening, the network returning): it starts a fresh
  // chain of follow-ups.
  if (reason !== 'followup') followUps = 0;
  scheduler.add(reason, opts.delayMs);
}

/**
 * Compatibility entry for callers that still ask for a sync directly (refresh
 * from the cloud, resuming after sign-in). New code announces a fact on the bus
 * instead. `immediate` means "soon" (the merge window), not "this instant".
 */
export function requestSync(
  opts: { immediate?: boolean; delayMs?: number; followUp?: boolean } = {}
): void {
  schedule(opts.followUp ? 'followup' : opts.immediate ? 'manual' : 'progress', {
    delayMs: opts.delayMs,
  });
}

/** Study tab opened: sync at most once a minute. */
export function requestSyncOnStudyOpen(): void {
  const now = Date.now();
  if (now - lastTabTrigger < TAB_OPEN_MIN_GAP_MS) return;
  lastTabTrigger = now;
  schedule('study-open');
}

/** Called by the auth layer whenever Clerk's signed-in state or user changes. */
export function configureSyncSession(next: { signedIn: boolean; userId: string | null }): void {
  const changedUser = next.userId !== session.userId;
  session = next;
  if (!next.signedIn) {
    scheduler.clearPending();
    failures = 0;
    pausedForAuth = false;
    quotaBlocked = false;
    return;
  }
  if (changedUser) {
    pausedForAuth = false;
    failures = 0;
    scheduler.clearPending();
    quotaBlocked = false;
  }
  schedule('auth');
}

/** Waits (up to `timeoutMs`) for the outbox to drain. True if it is empty. */
export async function flushOutbox(timeoutMs: number): Promise<boolean> {
  if ((await refreshPending()) === 0) return true;
  if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, online: await isOnline() })) {
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
  const firstSyncOnDevice = (await AsyncStorage.getItem(CURSOR_KEY)) === null;
  const pendingNow = (await readPendingSettings()).size > 0;
  const auxAllowed = getAppConfigNow().flags.settingsSyncEnabled;
  if (
    auxAllowed &&
    (firstSyncOnDevice || pendingNow || Date.now() - lastAuxSyncAt > AUX_SYNC_MIN_GAP_MS)
  ) {
    aux = await buildAuxRequest({ accountWins: firstSyncOnDevice });
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
  // value needs adopting: one more (coalesced) round settles it. Never more than
  // MAX_FOLLOW_UPS in a row: if something keeps asking, stop and wait for a real
  // event instead of syncing every few seconds while the phone is idle.
  const next = nextFollowUps(followUps, needsAnotherRound);
  followUps = next.followUps;
  if (next.schedule) schedule('followup');
}

/** Runs one sync round (push then pull). Safe to call at any time. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    scheduler.add('manual'); // asked for mid-round: one more round follows it
    return inFlight;
  }
  // Everything that wanted this round is served by it; anything arriving while
  // it runs lands in a fresh set for the next one.
  scheduler.beginWithoutRound();
  inFlight = (async () => {
    try {
      if (!canSync({ signedIn: session.signedIn, authEnabled: isAuthEnabled, online: true })) {
        return;
      }
      if (pausedForAuth) return;
      if (!getAppConfigNow().flags.syncEnabled) return; // admin kill switch
      if (!(await isOnline())) {
        setStatus({ state: 'offline' });
        await refreshPending();
        return;
      }
      setStatus({ state: 'syncing' });
      scheduler.roundStarted();
      await runRound();
      failures = 0;
      setStatus({ state: 'idle' });
    } catch (err) {
      const e = err as ApiError;
      if (e?.code === 'sync_disabled') {
        // An admin paused sync server-side. Pick up the config (so the app itself
        // stops asking) and look again much later; local data is untouched.
        void refreshAppConfig({ force: true });
        setStatus({ state: 'idle' });
        scheduler.retryIn(15 * 60 * 1000);
        return;
      }
      if (e?.status === 401) {
        // Session not usable right now. Keep the outbox; never wipe on a 401.
        pausedForAuth = true;
        setStatus({ state: 'paused' });
      } else if (e?.status === 429) {
        const wait = Math.max(1, e.retryAfterSec ?? 60) * 1000;
        scheduler.holdFor(wait); // no event may bring the next round forward
        setStatus({ state: 'error' });
        scheduler.retryIn(wait);
      } else {
        setStatus({ state: e?.kind === 'offline' ? 'offline' : 'error' });
        scheduler.retryIn(backoffMs(failures));
        failures += 1;
      }
    } finally {
      await refreshPending().catch(() => {});
      inFlight = null;
      scheduler.end(); // events that arrived mid-round get their one timer
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
export async function syncFromBackground(): Promise<string> {
  if (!isAuthEnabled) return 'skipped: accounts are off';
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (!owner) return 'skipped: no account data on this phone';
  const userId = await getSignedInUserId();
  if (!userId) return 'skipped: Clerk reports signed out (headless session not available)';
  if (userId !== owner) return 'skipped: a different account is signed in';
  await loadCachedAppConfig(); // headless: nothing has loaded the config yet
  if (!getAppConfigNow().flags.syncEnabled) return 'skipped: sync is paused by an admin';
  if (!getAppConfigNow().flags.nudgesEnabled) return 'skipped: nudges are paused by an admin';
  session = { signedIn: true, userId };
  await syncNow();
  return status.state === 'idle' ? 'synced' : `ended in state "${status.state}"`;
}

/**
 * Re-reads everything from the account: forgets the sync cursor so the next
 * round is a full pull and merge (the same path as a first sign-in on a phone),
 * then syncs now. Anything the account has that this phone lost comes back; what
 * the phone has that the account lacks is pushed. Safe to call any time while
 * signed in - used after "Clear cached data" as a belt-and-braces refresh, so a
 * signed-in student never has to sign out and in again to get their progress back.
 */
export async function refreshFromCloud(): Promise<void> {
  if (!session.signedIn) return;
  try {
    await AsyncStorage.removeItem(CURSOR_KEY);
  } catch {}
  schedule('manual');
}

/** The sign-in sheet or token refresh resolved: allow syncing again. */
export function resumeAfterAuth(): void {
  pausedForAuth = false;
  schedule('auth');
}

// --- wiring ----------------------------------------------------------------
//
// The engine reacts to facts announced on the bus (src/events). It announces
// only results ('sync.status'), never anything that would trigger itself.

on('progress.changed', () => {
  void refreshPending();
  schedule('progress');
});
on('setting.changed', () => schedule('setting'));
on('recents.changed', () => schedule('recents'));
on('nudge.received', () => schedule('nudge'));
on('network.online', () => schedule('network'));
on('app.foreground', () => {
  if (pausedForAuth) pausedForAuth = false;
  schedule('foreground');
});
// Going to the background: send what is queued now rather than wait for the
// debounce, which the OS may never let run.
on('app.background', () => {
  if (scheduler.hasTimer || scheduler.pending > 0) schedule('background');
});

// Everything in memory that mirrors the removed data is reset with the wipe.
registerWipeHook(() => {
  scheduler.reset();
  followUps = 0;
  resetSettingsSyncMemory();
  failures = 0;
  pausedForAuth = false;
  quotaBlocked = false;
  lastTabTrigger = 0;
  lastAuxSyncAt = 0;
  setStatus({ state: 'idle', pending: 0, lastSyncAt: null });
});

void AsyncStorage.getItem(LAST_SYNC_KEY)
  .then((raw) => raw && setStatus({ lastSyncAt: Number(raw) || null }))
  .catch(() => {});
