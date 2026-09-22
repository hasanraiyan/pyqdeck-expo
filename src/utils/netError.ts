import * as Network from 'expo-network';

/**
 * Turns a thrown request failure into copy a student can act on.
 *
 * The platform's own transport errors are written for whoever is holding the
 * stack trace, not for the person holding the phone - Android throws
 * `Unable to resolve host "api.pyqdeck.in": No address associated with
 * hostname`, React Native's fetch throws a bare `Network request failed`, and
 * both used to reach the screen verbatim because every caller does
 * `e?.message || 'Could not load X.'` and `e.message` is never empty.
 *
 * So the rule is: classify here, and let ApiError carry a message that is
 * always safe to render. The raw text stays on `cause` for Sentry.
 */

/** Why a request failed, for callers that want to react rather than just print. */
export type FailureKind =
  | 'offline' // device has no working connection
  | 'unreachable' // device is online, our server did not answer
  | 'timeout'
  | 'rateLimited'
  | 'notFound'
  | 'server' // 5xx
  | 'auth' // 401/403
  | 'unknown';

export const MESSAGES: Record<FailureKind, string> = {
  offline: "You're offline. Check your internet connection and try again.",
  unreachable: "Couldn't reach PYQdeck. The server may be busy - please try again.",
  timeout: 'That took too long to load. Check your connection and try again.',
  rateLimited: "You're going a bit fast. Wait a moment and try again.",
  notFound: "We couldn't find that - it may have been moved or removed.",
  server: 'Something went wrong on our end. Please try again in a moment.',
  auth: 'Please sign in again to continue.',
  unknown: 'Something went wrong. Please try again.',
};

// Substrings the platforms use for a transport-level failure. Matched
// case-insensitively against the raw message; anything here means the request
// never got an answer, as opposed to getting an unhappy one.
const TRANSPORT_HINTS = [
  'network request failed',
  'unable to resolve host',
  'no address associated with hostname',
  'fetch failed',
  'failed to fetch',
  'connection refused',
  'econnrefused',
  'enotfound',
  'econnreset',
  'connection abort',
  'software caused connection abort',
  'network is unreachable',
  'ssl handshake',
  'trust anchor',
];

const TIMEOUT_HINTS = ['timeout', 'timed out', 'etimedout', 'aborted', 'abort'];

const contains = (haystack: string, needles: string[]) =>
  needles.some((n) => haystack.includes(n));

/** True when the raw error looks like the request never reached a server. */
export const isTransportError = (err: unknown): boolean => {
  const raw = String((err as any)?.message ?? err ?? '').toLowerCase();
  return contains(raw, TRANSPORT_HINTS) || contains(raw, TIMEOUT_HINTS);
};

export const isTimeoutError = (err: unknown): boolean =>
  contains(String((err as any)?.message ?? err ?? '').toLowerCase(), TIMEOUT_HINTS);

/**
 * Asks the OS whether there is a usable connection. Never throws: if the
 * check itself fails we assume we are online, because wrongly telling someone
 * they are offline is worse than a vague "couldn't reach us".
 *
 * isInternetReachable is undefined on a platform that has not probed yet, so
 * only an explicit `false` counts as offline.
 */
export const isDeviceOffline = async (): Promise<boolean> => {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return true;
    return state.isInternetReachable === false;
  } catch {
    return false;
  }
};

/** Maps an HTTP status onto the kind of failure it represents. */
export const kindForStatus = (status?: number): FailureKind => {
  if (!status) return 'unknown';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'notFound';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'unknown';
};

/**
 * The message to show for a caught error, preferring a message we wrote over
 * anything the platform produced. `fallback` is the screen's own wording for
 * the generic case ("Could not load notes."), used when the failure has no
 * more specific story to tell.
 */
export const userMessage = (err: unknown, fallback = MESSAGES.unknown): string => {
  const e = err as any;
  // ApiError already classified this at the point of failure.
  if (e?.userFacing && typeof e.message === 'string') return e.message;
  if (isTransportError(err)) {
    return isTimeoutError(err) ? MESSAGES.timeout : MESSAGES.unreachable;
  }
  const kind = kindForStatus(e?.status);
  if (kind !== 'unknown') return MESSAGES[kind];
  return fallback;
};
