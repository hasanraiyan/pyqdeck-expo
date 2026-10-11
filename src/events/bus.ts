/**
 * The app's in-process event bus (docs/SRS-event-driven-architecture.md, EVT).
 *
 * An event states a FACT that already happened ("a topic was ticked", "the app
 * came to the foreground"). It is never a command. Producers say what happened;
 * consumers decide what to do about it. That keeps the modules that cause a
 * change from importing the modules that react to it (the old code used
 * single-slot callbacks to avoid import cycles).
 *
 * Rules, the same as the server's bus:
 *  - In memory only. Nothing that must survive a restart lives here; the outbox,
 *    pending settings and the cursor stay in AsyncStorage. An event is a hint.
 *  - Handlers run AFTER the emitter continues (a microtask), so a tap never
 *    waits on a consumer.
 *  - A handler that throws is reported and swallowed: it must not break the
 *    emitter or the other handlers.
 *  - A reaction must not emit an event that makes itself run again. Emit
 *    results ("sync.status"), not triggers.
 *  - Anything that must not be lost and must finish in order (the sign-out
 *    wipe) stays a plain awaited call.
 */

declare const __DEV__: boolean | undefined;

export interface SyncStatusPayload {
  state: 'idle' | 'syncing' | 'offline' | 'paused' | 'error';
  pending: number;
  lastSyncAt: number | null;
}

export interface EventMap {
  // --- lifecycle (src/events/lifecycle.ts is the only producer) ---
  'app.foreground': void;
  'app.background': void;
  'network.online': void;
  // --- facts about the student's data ---
  /** A topic was ticked or un-ticked on this phone. Triggers a sync. */
  'progress.changed': { subjectId: string };
  /** Stored progress changed for any reason (tick, pull, rename, wipe). Screens re-read. */
  'progress.updated': void;
  /** An account setting was changed on this phone. Triggers a sync. */
  'setting.changed': { name: string };
  /** Jump Back In changed on this phone. Triggers a sync (debounced). */
  'recents.changed': void;
  /** A sync wrote account values to local storage; screens re-read them. */
  'settings.applied': void;
  /** A sync replaced the Jump Back In lists. */
  'recents.replaced': void;
  // --- other devices / server ---
  'nudge.received': { via: 'foreground' | 'headless' };
  // --- results (never triggers) ---
  'sync.status': SyncStatusPayload;
  'config.changed': void;
  'ads.changed': void;
  'backend.changed': void;
}

export type EventName = keyof EventMap;

type Args<K extends EventName> = EventMap[K] extends void ? [] : [EventMap[K]];
type Handler<K extends EventName> = (payload: EventMap[K]) => void | Promise<void>;

const handlers = new Map<EventName, Set<Handler<any>>>();

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

let reporter: (err: unknown, event: EventName) => void = (err, event) => {
  if (isDev()) console.warn(`[events] handler for "${event}" failed:`, err);
};

/** Where handler errors go (App.tsx points this at Sentry). */
export function setEventErrorReporter(fn: (err: unknown, event: EventName) => void): void {
  reporter = fn;
}

// --- dev diagnostics -----------------------------------------------------------

const LOG_SIZE = 200;
const STORM_PER_SECOND = 20;
const log: { at: number; type: EventName }[] = [];
const stormCount = new Map<EventName, { windowStart: number; count: number; warned: boolean }>();

function trace(type: EventName): void {
  if (!isDev()) return;
  const now = Date.now();
  log.push({ at: now, type });
  if (log.length > LOG_SIZE) log.shift();

  const s = stormCount.get(type) ?? { windowStart: now, count: 0, warned: false };
  if (now - s.windowStart >= 1000) {
    s.windowStart = now;
    s.count = 0;
    s.warned = false;
  }
  s.count += 1;
  if (s.count > STORM_PER_SECOND && !s.warned) {
    s.warned = true;
    console.warn(
      `[events] "${type}" was emitted more than ${STORM_PER_SECOND} times in a second - ` +
        'a handler may be re-triggering itself.'
    );
  }
  stormCount.set(type, s);
}

/** The last events (dev builds only; empty in release). */
export function getEventLog(): readonly { at: number; type: EventName }[] {
  return log;
}

// --- core ----------------------------------------------------------------------

/** Registers a handler. Returns the unsubscribe function. */
export function on<K extends EventName>(type: K, handler: Handler<K>): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler);
  return () => {
    handlers.get(type)?.delete(handler);
  };
}

/** Like `on`, but removes itself after the first event. */
export function once<K extends EventName>(type: K, handler: Handler<K>): () => void {
  const off = on(type, (payload) => {
    off();
    return handler(payload);
  });
  return off;
}

function run<K extends EventName>(type: K, payload: EventMap[K]): void {
  const set = handlers.get(type);
  if (!set || set.size === 0) return;
  // A snapshot: a handler that unsubscribes (or subscribes) while this event
  // is being delivered must not change who receives it.
  for (const handler of [...set]) {
    try {
      const result = handler(payload);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => reporter(err, type));
      }
    } catch (err) {
      reporter(err, type);
    }
  }
}

/** Fire and forget. Handlers run after the caller continues. */
export function emit<K extends EventName>(type: K, ...args: Args<K>): void {
  trace(type);
  const payload = args[0] as EventMap[K];
  queueMicrotask(() => run(type, payload));
}

/** Test hook: forget every handler and the dev log. */
export function resetBus(): void {
  handlers.clear();
  log.length = 0;
  stormCount.clear();
}
