/**
 * Pure logic for syllabus progress sync: record merging, the outbox, batching,
 * server-result handling and backoff. No storage or network imports, so it runs
 * under `node --test` (see progressLogic.test.ts).
 */

/** A stored progress record: d = done, t = updatedAt (ms; 0 = migrated v1). */
export interface ProgressRecord {
  d: boolean;
  t: number;
}

export type SubjectProgress = Record<string, ProgressRecord>;

/** One queued change, ready to send. */
export interface OutboxOp {
  opId: string;
  subject: string;
  moduleId: string;
  topicId: string;
  done: boolean;
  updatedAt: number;
}

export interface RemoteItem {
  subject: string;
  moduleId: string;
  topicId: string;
  done: boolean;
  updatedAt: number;
}

export type Outbox = Record<string, OutboxOp>;

export const topicKey = (moduleId: string, topicId: string) => `${moduleId}:${topicId}`;

export function splitTopicKey(key: string): { moduleId: string; topicId: string } | null {
  const i = key.indexOf(':');
  if (i <= 0 || i === key.length - 1) return null;
  return { moduleId: key.slice(0, i), topicId: key.slice(i + 1) };
}

export const outboxKey = (subject: string, key: string) => `${subject}|${key}`;

const opTopicKey = (op: { moduleId: string; topicId: string }) => topicKey(op.moduleId, op.topicId);

/**
 * Does a server record replace the local one? Newer wins; on a tie "done" wins
 * (same rule as the server); a migrated v1 record (t = 0) loses to anything.
 */
export function remoteWins(local: ProgressRecord | undefined, remote: RemoteItem): boolean {
  if (!local) return true;
  if (local.t === 0) return true;
  if (remote.updatedAt !== local.t) return remote.updatedAt > local.t;
  return remote.done && !local.d;
}

/** Applies pulled items to a subject's records. Returns whether anything changed. */
export function applyRemote(
  records: SubjectProgress,
  items: readonly RemoteItem[],
  pendingKeys: ReadonlySet<string> = new Set()
): { records: SubjectProgress; changed: boolean } {
  let changed = false;
  const next: SubjectProgress = { ...records };
  for (const item of items) {
    const key = topicKey(item.moduleId, item.topicId);
    // A change still queued locally is newer than the server by definition;
    // let the push settle it instead of overwriting it with older state.
    if (pendingKeys.has(key)) continue;
    if (remoteWins(next[key], item)) {
      const incoming = { d: item.done, t: item.updatedAt };
      if (!next[key] || next[key].d !== incoming.d || next[key].t !== incoming.t) changed = true;
      next[key] = incoming;
    }
  }
  return { records: next, changed };
}

/** Coalesces a new local change into the outbox (one entry per topic). */
export function enqueue(outbox: Outbox, op: OutboxOp): Outbox {
  return { ...outbox, [outboxKey(op.subject, opTopicKey(op))]: op };
}

export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface OpResult {
  opId: string | null;
  status: 'applied' | 'superseded' | 'rejected';
  code?: string;
}

/**
 * Drops settled ops from the outbox. Everything the server answered for leaves
 * the queue: applied and superseded are done; a rejected op can never succeed
 * on retry (bad shape, unknown subject, over quota), so keeping it would loop
 * forever - the data itself stays in the local store. An op is only removed if
 * the outbox entry is still the one that was sent: a newer tick on the same
 * topic has a different opId and must survive.
 */
export function settle(
  outbox: Outbox,
  sent: readonly OutboxOp[],
  results: readonly OpResult[]
): { outbox: Outbox; quotaExceeded: boolean; rejected: number } {
  const answered = new Set(results.map((r) => r.opId).filter((id): id is string => !!id));
  let quotaExceeded = false;
  let rejected = 0;
  for (const r of results) {
    if (r.status === 'rejected') rejected += 1;
    if (r.code === 'quota_exceeded') quotaExceeded = true;
  }
  const next: Outbox = { ...outbox };
  for (const op of sent) {
    if (!answered.has(op.opId)) continue;
    const k = outboxKey(op.subject, opTopicKey(op));
    if (next[k]?.opId === op.opId) delete next[k];
  }
  return { outbox: next, quotaExceeded, rejected };
}

/**
 * First sign-in merge: after pulling the full server state, local-only or
 * locally-newer records must be pushed. Returns the ops to queue.
 */
export function planFirstPush(
  local: Record<string, SubjectProgress>,
  remote: readonly RemoteItem[],
  newOpId: () => string
): OutboxOp[] {
  const remoteByKey = new Map<string, RemoteItem>();
  for (const r of remote) remoteByKey.set(outboxKey(r.subject, topicKey(r.moduleId, r.topicId)), r);
  const ops: OutboxOp[] = [];
  for (const [subject, records] of Object.entries(local)) {
    for (const [key, rec] of Object.entries(records)) {
      const parts = splitTopicKey(key);
      if (!parts) continue;
      const r = remoteByKey.get(outboxKey(subject, key));
      // The server already has a record this one does not beat: nothing to push.
      if (r && remoteWins(rec, r)) continue;
      // An un-tick with no server record has nothing to cancel.
      if (!r && !rec.d) continue;
      ops.push({
        opId: newOpId(),
        subject,
        moduleId: parts.moduleId,
        topicId: parts.topicId,
        done: rec.d,
        updatedAt: rec.t,
      });
    }
  }
  return ops;
}

export const BACKOFF_START_MS = 5_000;
export const BACKOFF_CAP_MS = 15 * 60_000;

/** Exponential backoff for the nth consecutive failure (0-based). */
export function backoffMs(failures: number): number {
  return Math.min(BACKOFF_CAP_MS, BACKOFF_START_MS * 2 ** Math.max(0, failures));
}

export interface SyncGate {
  signedIn: boolean;
  authEnabled: boolean;
  syncEnabled: boolean;
  online: boolean;
}

/** AND-FR-9: the only conditions under which a sync round may run. */
export function canSync(g: SyncGate): boolean {
  return g.signedIn && g.authEnabled && g.syncEnabled && g.online;
}

/** Count of done topics, optionally limited to keys in the loaded syllabus. */
export function countDone(
  records: SubjectProgress | undefined,
  validKeys?: ReadonlySet<string>
): number {
  if (!records) return 0;
  let n = 0;
  for (const [key, rec] of Object.entries(records)) {
    if (rec.d && (!validKeys || validKeys.has(key))) n += 1;
  }
  return n;
}
