import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  applyRemote,
  enqueue,
  splitTopicKey,
  type Outbox,
  type RemoteItem,
  type SubjectProgress,
} from './progressLogic';

/**
 * Syllabus progress, local-first. Every tick is written here first (so it works
 * signed out and offline) and, when the student is signed in, also queued in an
 * outbox that the sync engine (progressSync.ts) sends to their account.
 *
 * Storage (v2): one key per subject, `pyqdeck:progress:<subjectId>`, holding
 * `{ "<moduleId>:<topicId>": { d: done, t: updatedAt } }`. Un-ticks are kept as
 * `d: false` records so they sync as well. The v1 format (`syllabus_done_*`,
 * an array of done keys with no timestamps) is migrated on first read.
 *
 * Nothing here ever deletes a record because it is missing from the syllabus
 * the screen happens to hold: that syllabus can be a stale offline copy, and
 * with sync a prune would become a destructive write.
 */

const V2_PREFIX = 'pyqdeck:progress:';
const V1_PREFIX = 'syllabus_done_';
const OUTBOX_KEY = 'pyqdeck:progress_outbox';

const v2Key = (subjectId: string) => `${V2_PREFIX}${subjectId}`;

// All reads-modify-writes go through one queue so two screens ticking at once
// cannot overwrite each other with a stale copy (the old whole-set rewrite did).
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// --- change notifications --------------------------------------------------

const listeners = new Set<() => void>();
/** Fires after progress changes locally or a pull applied remote changes. */
export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notify = () => listeners.forEach((fn) => fn());

let onLocalChange: (() => void) | null = null;
/** The sync engine registers here so a tick can schedule a debounced sync. */
export function setLocalChangeHandler(fn: (() => void) | null): void {
  onLocalChange = fn;
}

// --- low-level read/write --------------------------------------------------

async function readRecords(subjectId: string): Promise<SubjectProgress> {
  try {
    const raw = await AsyncStorage.getItem(v2Key(subjectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRecords(subjectId: string, records: SubjectProgress): Promise<void> {
  await AsyncStorage.setItem(v2Key(subjectId), JSON.stringify(records));
}

export async function loadOutbox(): Promise<Outbox> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Replaces the outbox through the shared queue (used by the sync engine). */
export function updateOutbox(fn: (current: Outbox) => Outbox): Promise<Outbox> {
  return exclusive(async () => {
    const next = fn(await loadOutbox());
    if (Object.keys(next).length === 0) await AsyncStorage.removeItem(OUTBOX_KEY);
    else await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    return next;
  });
}

// --- v1 -> v2 migration ----------------------------------------------------

let migrated = false;

// Runs inside the exclusive queue. v1 keys are removed only after their v2
// write succeeded, so a crash just retries on the next launch.
async function migrateInsideQueue(): Promise<void> {
  if (migrated) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(V1_PREFIX));
    for (const key of keys) {
      const subjectId = key.slice(V1_PREFIX.length);
      const raw = await AsyncStorage.getItem(key);
      let list: unknown = [];
      try {
        list = raw ? JSON.parse(raw) : [];
      } catch {}
      const existing = await readRecords(subjectId);
      for (const k of Array.isArray(list) ? list : []) {
        if (typeof k === 'string' && !existing[k]) existing[k] = { d: true, t: 0 };
      }
      await writeRecords(subjectId, existing);
      await AsyncStorage.removeItem(key);
    }
    migrated = true;
  } catch {
    // leave `migrated` false so the next call retries
  }
}

/**
 * Converts every `syllabus_done_<id>` array into v2 records with updatedAt 0
 * ("ticked before timestamps existed", which loses to any server record).
 */
export function migrateProgressV1(): Promise<void> {
  return migrated ? Promise.resolve() : exclusive(migrateInsideQueue);
}

// --- reads -----------------------------------------------------------------

/** Every record for one subject (done and un-ticked). */
export async function getProgressRecords(subjectId: string): Promise<SubjectProgress> {
  await migrateProgressV1();
  return readRecords(subjectId);
}

/** Topic keys marked done for one subject. */
export async function getDoneTopics(subjectId: string): Promise<Set<string>> {
  const records = await getProgressRecords(subjectId);
  const done = new Set<string>();
  for (const [key, rec] of Object.entries(records)) if (rec?.d) done.add(key);
  return done;
}

/**
 * Done topics limited to those present in the syllabus on screen. Records for
 * topics the screen does not know about are kept in storage, just not counted.
 */
export async function getDoneTopicsIn(
  subjectId: string,
  validTopicKeys: Set<string>
): Promise<Set<string>> {
  const done = await getDoneTopics(subjectId);
  const visible = new Set<string>();
  done.forEach((key) => {
    if (validTopicKeys.has(key)) visible.add(key);
  });
  return visible;
}

/**
 * Counts for a list of subjects in one pass - the overview screen needs every
 * subject's progress at once, and multiGet is a single bridge crossing rather
 * than one per subject.
 */
export async function getDoneCounts(subjectIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (subjectIds.length === 0) return counts;
  try {
    await migrateProgressV1();
    const pairs = await AsyncStorage.multiGet(subjectIds.map(v2Key));
    pairs.forEach(([key, raw]) => {
      const id = key.slice(V2_PREFIX.length);
      try {
        const parsed = raw ? (JSON.parse(raw) as SubjectProgress) : {};
        counts[id] = Object.values(parsed).filter((r) => r?.d).length;
      } catch {
        counts[id] = 0;
      }
    });
  } catch {
    subjectIds.forEach((id) => (counts[id] = 0));
  }
  return counts;
}

/** All local records by subject, for the first-sign-in merge. */
export async function getAllProgress(): Promise<Record<string, SubjectProgress>> {
  await migrateProgressV1();
  const out: Record<string, SubjectProgress> = {};
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(V2_PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [key, raw] of pairs) {
      try {
        if (raw) out[key.slice(V2_PREFIX.length)] = JSON.parse(raw);
      } catch {}
    }
  } catch {}
  return out;
}

// --- writes ----------------------------------------------------------------

/**
 * Marks one topic done or not done. Writes locally first and returns as soon as
 * that is persisted; the network is never awaited. When `queueForSync` is true
 * the change is also added to the outbox (coalesced per topic).
 */
export function setTopicDone(
  subjectId: string,
  key: string,
  done: boolean,
  queueForSync = true
): Promise<void> {
  return exclusive(async () => {
    await migrateInsideQueue();
    const updatedAt = Date.now();
    const records = await readRecords(subjectId);
    records[key] = { d: done, t: updatedAt };
    await writeRecords(subjectId, records);

    const parts = splitTopicKey(key);
    if (queueForSync && parts) {
      const outbox = enqueue(await loadOutbox(), {
        opId: Crypto.randomUUID(),
        subject: subjectId,
        moduleId: parts.moduleId,
        topicId: parts.topicId,
        done,
        updatedAt,
      });
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    }
    notify();
    onLocalChange?.();
  }).catch(() => {});
}

/**
 * A subject's slug can be renamed by an admin, and progress is stored under the
 * slug the app knew. When the syllabus now on screen (`validKeys`, ids that
 * survive a rename) matches records stored under a different subject key while
 * this subject has none, those records belong to the renamed subject: move
 * them (and their queued outbox ops) to the new key. Returns true if it moved.
 */
export function adoptRenamedSubject(subjectId: string, validKeys: Set<string>): Promise<boolean> {
  if (validKeys.size === 0) return Promise.resolve(false);
  return exclusive(async () => {
    await migrateInsideQueue();
    if (Object.keys(await readRecords(subjectId)).length > 0) return false;
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (k) => k.startsWith(V2_PREFIX) && k !== v2Key(subjectId)
    );
    for (const storageKey of keys) {
      const raw = await AsyncStorage.getItem(storageKey);
      let records: SubjectProgress = {};
      try {
        records = raw ? JSON.parse(raw) : {};
      } catch {}
      if (!Object.keys(records).some((k) => validKeys.has(k))) continue;
      const oldSubject = storageKey.slice(V2_PREFIX.length);
      await writeRecords(subjectId, records);
      await AsyncStorage.removeItem(storageKey);
      const outbox = await loadOutbox();
      let touched = false;
      for (const [k, op] of Object.entries(outbox)) {
        if (op.subject !== oldSubject) continue;
        delete outbox[k];
        outbox[`${subjectId}|${op.moduleId}:${op.topicId}`] = { ...op, subject: subjectId };
        touched = true;
      }
      if (touched) await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
      notify();
      return true;
    }
    return false;
  }).catch(() => false);
}

/** Queues ops for records that exist locally but not on the server yet. */
export function queueOps(ops: Parameters<typeof enqueue>[1][]): Promise<void> {
  return updateOutbox((box) => ops.reduce((acc, op) => enqueue(acc, op), box)).then(() => {});
}

/**
 * Applies items pulled from the server. Topics with a change still waiting in
 * the outbox are skipped: that change is newer than anything the server had.
 */
export function applyPulledItems(items: RemoteItem[]): Promise<boolean> {
  if (items.length === 0) return Promise.resolve(false);
  return exclusive(async () => {
    const outbox = await loadOutbox();
    const pendingBySubject = new Map<string, Set<string>>();
    for (const op of Object.values(outbox)) {
      const set = pendingBySubject.get(op.subject) ?? new Set<string>();
      set.add(`${op.moduleId}:${op.topicId}`);
      pendingBySubject.set(op.subject, set);
    }
    const bySubject = new Map<string, RemoteItem[]>();
    for (const item of items) {
      const list = bySubject.get(item.subject) ?? [];
      list.push(item);
      bySubject.set(item.subject, list);
    }
    let anyChanged = false;
    for (const [subjectId, list] of bySubject) {
      const current = await readRecords(subjectId);
      const { records, changed } = applyRemote(current, list, pendingBySubject.get(subjectId));
      if (changed) {
        await writeRecords(subjectId, records);
        anyChanged = true;
      }
    }
    if (anyChanged) notify();
    return anyChanged;
  });
}

/** Removes every progress record (v1, v2) and the outbox. Part of the sign-out wipe. */
export async function clearSyllabusProgress(): Promise<void> {
  await exclusive(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(
      (k) => k.startsWith(V1_PREFIX) || k.startsWith(V2_PREFIX) || k === OUTBOX_KEY
    );
    if (mine.length) await AsyncStorage.multiRemove(mine);
    migrated = false;
    notify();
  });
}
