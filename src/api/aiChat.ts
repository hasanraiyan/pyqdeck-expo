import { fetch as streamFetch } from 'expo/fetch';
import * as Backend from './backend';
import { ApiError } from './index';
import { authHeader } from '../auth/token';
import { AiOverviewReference } from '../types';
import { FailureKind, MESSAGES, isDeviceOffline, isTimeoutError, kindForStatus } from '../utils/netError';

/**
 * Streaming AI chat client.
 *
 * Talks to POST /search/ai-chat/stream, which answers with server-sent events.
 * React Native has no EventSource, so the body is read with getReader() and
 * parsed here. `fetch` comes from 'expo/fetch' by name (SDK 57 docs): it is the
 * streaming-capable implementation, and importing it explicitly means this
 * keeps working even if EXPO_PUBLIC_USE_RN_FETCH is ever set.
 *
 * This deliberately does not go through request() in ./index: that helper
 * reads the whole body as JSON, and its failover-after-the-fact logic only
 * makes sense before any byte has been consumed. The same rule is applied here
 * by hand - fail over once if the connection or a 5xx comes back BEFORE the
 * first byte, never after.
 */

export type AiChatEvent =
  | { type: 'meta'; conversationId: string; turn: number }
  | { type: 'step'; label: string }
  | { type: 'references'; references: AiOverviewReference[] }
  | { type: 'delta'; text: string }
  | { type: 'related'; questions: string[] }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

/** Server error codes the UI reacts to specially. */
export const CHAT_DISABLED = 'chat_disabled';
export const CHAT_BAD_CONVERSATION = 'bad_conversation';
export const CHAT_TURN_LIMIT = 'turn_limit';

// Longest we wait for the connection and response headers. Once the stream is
// open there is no cap: a long answer is fine, and Stop aborts it.
const CONNECT_TIMEOUT_MS = 20000;

/**
 * Incremental SSE parser. Feed it decoded text in any slicing; it emits each
 * complete event (blocks end in a blank line). Handles CRLF, a CR/LF pair
 * split across chunks, comment lines (heartbeats) and multi-line data.
 */
export const createSseParser = (onEvent: (name: string, data: any) => void) => {
  let buf = '';
  return {
    push(text: string) {
      // Normalising the WHOLE buffer each time is what stitches a "\r" at the
      // end of one chunk to the "\n" at the start of the next.
      buf = (buf + text).replace(/\r\n/g, '\n');
      let at: number;
      while ((at = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, at);
        buf = buf.slice(at + 2);
        let name = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
          if (field === 'event') name = value;
          else if (field === 'data') data.push(value);
        }
        if (!data.length) continue;
        try {
          onEvent(name, JSON.parse(data.join('\n')));
        } catch {
          // A malformed block must not kill the whole stream.
        }
      }
    },
  };
};

const toEvent = (name: string, data: any): AiChatEvent | null => {
  switch (name) {
    case 'meta':
      return { type: 'meta', conversationId: String(data.conversationId ?? ''), turn: Number(data.turn) || 1 };
    case 'step':
      return { type: 'step', label: String(data.label ?? '') };
    case 'references':
      return { type: 'references', references: Array.isArray(data.references) ? data.references : [] };
    case 'delta':
      return { type: 'delta', text: String(data.text ?? '') };
    case 'related':
      return { type: 'related', questions: Array.isArray(data.questions) ? data.questions.map(String) : [] };
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', code: String(data.code ?? 'upstream'), message: String(data.message ?? '') };
    default:
      return null; // unknown events from a newer server are ignored
  }
};

interface StreamArgs {
  query: string;
  /**
   * The search this chat grew out of. Sent on the first turn only, so the new
   * session knows what "explain that further" refers to.
   */
  about?: string;
  conversationId?: string | null;
  signal?: AbortSignal;
  onEvent: (event: AiChatEvent) => void;
}

/**
 * Sends one chat turn and calls onEvent as events arrive. Resolves when the
 * stream ends (after a `done` or `error` event); rejects with ApiError for
 * failures before the stream opens (offline, 401, 429, 5xx). A caller abort
 * resolves quietly.
 */
export async function streamAiChat(args: StreamArgs, isRetry = false): Promise<void> {
  const { query, about, conversationId, signal, onEvent } = args;
  const origin = await Backend.ready();
  const url = `${origin.root}/api/public/search/ai-chat/stream`;

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onOuterAbort);
  }

  let opened = false;
  try {
    const res = await streamFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(await authHeader()),
      },
      body: JSON.stringify({
        query,
        ...(conversationId ? { conversationId } : about ? { about } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(connectTimer);

    if (!res.ok) {
      // Same rule as request(): 5xx says this origin is sick, 4xx (401 sign-in,
      // 429 limit) says nothing about origin health and must not be retried.
      if (res.status >= 500 && !isRetry && (await Backend.failover(origin.id))) {
        return streamAiChat(args, true);
      }
      const errData: any = await res.json().catch(() => ({}));
      const rawRetry = res.headers?.get?.('Retry-After');
      const kind: FailureKind = kindForStatus(res.status);
      throw new ApiError(
        errData?.message || MESSAGES[kind],
        res.status,
        rawRetry ? Number(rawRetry) : undefined,
        kind
      );
    }

    opened = true;
    const parser = createSseParser((name, data) => {
      const event = toEvent(name, data);
      if (event) onEvent(event);
    });

    const reader = res.body?.getReader?.();
    if (reader && typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
    } else {
      // No streaming body or decoder on this runtime: read it all and replay
      // the events, so chat degrades to non-streaming instead of failing.
      parser.push(await res.text());
    }
    // A final block with no trailing blank line is still an event.
    parser.push('\n\n');
  } catch (err: any) {
    clearTimeout(connectTimer);
    if (err instanceof ApiError) throw err;
    // Stop / leaving the screen: nothing to report.
    if (signal?.aborted) return;

    // Failed before the first byte: worth one try on the other origin.
    if (!opened && !isRetry && (await Backend.failover(origin.id))) {
      return streamAiChat(args, true);
    }
    // Dropped mid-answer: the partial text stays, the caller shows Retry.
    if (opened) {
      onEvent({ type: 'error', code: 'interrupted', message: MESSAGES.unreachable });
      return;
    }
    const kind: FailureKind = (await isDeviceOffline())
      ? 'offline'
      : isTimeoutError(err)
        ? 'timeout'
        : 'unreachable';
    throw new ApiError(MESSAGES[kind], undefined, undefined, kind, err);
  } finally {
    clearTimeout(connectTimer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
