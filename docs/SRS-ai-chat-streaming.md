# SRS: Streaming AI Answers and Chat-style Follow-ups

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Component | Backend `server/server/routes/publicDataRoutes.js` + new `aiChatService.js`; app new `AiChatScreen`, `ThinkingIndicator`, `src/api/aiChat.ts`, `AiOverviewCard.tsx` |
| Status | Draft, awaiting approval |
| Extends | `SRS-ai-follow-up-questions.md` (which covers only the tap-a-chip-and-search flow and excludes chat and streaming) |
| Evidence | Live calls against engine `pyqdeck_1787542792054`; raw responses in `docs/samples/` |

## 1. Purpose
Turn the one-shot AI overview into a chat-like experience: the answer streams in as it is generated, the student can ask follow-up questions that remember the conversation, each answer offers new follow-up chips, and the wait before the first word shows the Claude-style "Thinking" spinner.

### 1.1 Hard constraint (unchanged)
Installed Android builds and the web frontend keep working with no update. Everything here is **new endpoints and new screens**. The existing `POST /search/ai-overview` is not modified by this document.

### 1.2 Out of scope (v1)
Voice input, image input, saving or syncing chats across devices, sharing a whole chat, admin moderation of chats.

## 2. Research findings (all verified live unless marked)

### 2.1 Google side
| Finding | Evidence |
|---|---|
| `POST .../engines/{id}/sessions` (body `{"userPseudoId": "..."}`) creates a session and returns `name` ending in `/sessions/<id>` | HTTP 200, `docs/samples/session-create.json` |
| `servingConfigs/default_search:streamAnswer` (v1) works on this engine and returns a JSON **array** of chunks, 20 chunks for turn 1 | `docs/samples/stream-answer-turn1.json` |
| Chunk order: step info (`steps`, e.g. "Rephrase the query") → `references` (early, before any text) → many `answerText` **deltas** (each chunk is only the next piece of text) → `citations` → `relatedQuestions` → final chunk with `state: SUCCEEDED` and the full `answerText` | same file |
| Every chunk carries `answer.name`, `state` (`STREAMING` then `SUCCEEDED`), `answerQueryToken`, `session` | same file |
| **Multi-turn works.** Turn 2 in the same `session` with the bare query "explain narrow ai further" answered about Narrow AI, using turn 1 as context | `docs/samples/stream-answer-turn2.json` |
| `relatedQuestions` are regenerated per turn and fit the new topic (turn 2: "What are the limitations of narrow AI?") | same |
| A `promptSpec.preamble` of "Answer in under 120 words." shortens answers (turn 1 was a short paragraph instead of the multi-section essay) | turn 1 file |
| Citations arrive only at the end and use string offsets; references arrive first with the page URL in `chunkInfo.documentMetadata.uri` | turn 1 file |

Measured latency (one run each, from this machine, so indicative only):

| | Turn 1 | Turn 2 |
|---|---|---|
| Time to first byte | 3.1 s | 4.2 s |
| Time to first answer text | not measured | 4.8 s |
| Related questions available | not measured | 5.9 s |
| Total | 4.8 s | 6.0 s |

Most of the wait is before any text: query rephrasing and retrieval. Streaming makes the answer readable from about 4.8 s instead of 6 s, which is a small gain by itself. The bigger win is the chat feel and follow-ups, and covering the pre-text gap with the Thinking indicator and step labels.

**Not measured:** price per call and per session, session lifetime and any limit, whether `session: ".../sessions/-"` auto-creates a session (documented but untested), behaviour with concurrent turns in one session, and quality across many query types.

### 2.2 Backend infrastructure (from the repo)
- `server.js` already excludes `text/event-stream` from `compression`, so SSE routes are already supported by the app server.
- `trust proxy` is 1; traffic comes through Cloudflare and one of two origins (EC2 or Render). **No proxy config (nginx, Render, Cloudflare rules) is in the repo**, so response buffering on those layers is unverified. This is the top infrastructure risk (section 8).
- Auth: `attachUser` enriches requests with the Clerk user when a token is present; `requireSignIn` is per-route. The current overview is anonymous and limited to 40/hour per account or IP.

### 2.3 App side (Expo SDK 57, RN 0.86)
- Per the v57 docs, `expo/fetch` supports streaming response bodies (`response.body.getReader()`), and on Android and iOS it is the default global `fetch` unless `EXPO_PUBLIC_USE_RN_FETCH=1` is set. The repo does not set that variable. Use the named import `import { fetch } from 'expo/fetch'` so behaviour does not depend on the variable.
- `EventSource` does not exist in React Native, so the SSE stream is read with `getReader()` and parsed by hand (small function, no new dependency).
- The app's `request()` in `src/api/index.ts` does not fit streaming: it awaits `Backend.ready()`, reads the body as JSON, and does failover after the fact. Streaming gets its own function that reuses `Backend`'s current origin and only fails over **before the first byte**.

## 3. Design

### 3.1 New backend endpoints (all additive)
| Endpoint | Purpose |
|---|---|
| `POST /search/ai-chat/stream` | Body `{ query, conversationId? }`. Returns `text/event-stream`. Creates a Google session on the first turn, reuses it afterwards. |
| `GET /search/ai-overview/status` | Existing. Gains an **additive** `chat: boolean` key. Old apps read only `enabled`. |

Turns are stateless on the wire. The server owns the Google session and hands the client an opaque `conversationId`.

### 3.2 Event contract (server to client)
The server translates Google's chunks so the app never depends on Google's shapes:

| Event | Data | When |
|---|---|---|
| `meta` | `{ conversationId }` | First event of every turn |
| `step` | `{ label }` (e.g. "Searching past papers") | Optional, while thinking |
| `references` | `[{ index, title, url, navigate }]` in the same shape the overview uses today (reuse `canonicalUrl`/`parseLink`) | Once, before text |
| `delta` | `{ text }` | Each text piece |
| `related` | `{ questions: string[] }` | After the text |
| `done` | `{ cached: false }` | End of turn |
| `error` | `{ code, message }` | Any failure; then the stream closes |

Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `Connection: keep-alive`. A `:` comment heartbeat every 15 s keeps proxies from cutting an idle stream. `related` normalisation follows F3 in the follow-up SRS (trim, dedupe, at most 4, at most 120 chars).

Inline citation chips are dropped in chat (the card already dropped them for one Sources pill), so the late-arriving citation offsets are not forwarded. Only `references` is needed.

### 3.3 Conversation and session handling
- `conversationId` is a **signed token** (HMAC with a server secret) wrapping the Google session name, the owner key (Clerk id, else IP), and an expiry (24 h). The server verifies it on every turn. A tampered or foreign id is rejected. This avoids a new database collection and stops a client from pointing the server at someone else's session.
- Cap: 10 turns per conversation. After that the app shows "Start a new chat".
- Google sessions are created with `userPseudoId` set to a hash of the owner key, never the raw Clerk id or IP.

### 3.4 Cost and abuse controls
Each turn is a billed call, and a chat invites many more calls than a search does.
- New `aiChatLimiter`, separate from `aiOverviewLimiter`: proposed 30 turns/hour, keyed by Clerk account (chat requires sign-in, so no IP fallback).
- Server-side caps: query at most 200 characters (as today), turns per conversation (above), one in-flight turn per conversation.
- Optional automatic safety net: `AI_CHAT_DAILY_TURN_CAP` (env, default off). When today's chat turns pass the cap, chat behaves as disabled until the next UTC day, so a spike cannot run up the bill before an admin notices.
- Log each turn in `AiOverviewLog` with a new `kind: 'chat'` field (existing rows and overview writes default to `'overview'`), plus turn number, so `manage_ai_overview usage` can report chat separately.
- Kill switches and sign-in: see 3.8.

### 3.8 Access model and admin controls (decided)
**Decision:** chat requires sign-in; the normal overview does not.

| Feature | Who can use it | Runtime switch | Default |
|---|---|---|---|
| AI overview (today) | Everyone, signed in or not | `ai_overview_enabled` (exists) | On |
| Follow-up chips on the overview | Everyone | `ai_followups_enabled` (new) | On |
| AI chat | **Signed-in users only** | `ai_chat_enabled` (new) | **Off** until an admin turns it on |

**Switch hierarchy:** env credentials → overview switch → follow-ups / chat switches. Turning the overview off also turns follow-ups and chat off. Chat is live only when `isAiOverviewLive() && ai_chat_enabled`. Shipping the code therefore costs nothing until an admin enables chat.

**Admin control (no redeploy, no app update):**
- Extend the existing `manage_ai_overview` MCP tool with an optional `feature` parameter: `overview` (default, so existing admin usage is unchanged), `followups`, or `chat`.
- `status` reports env, per-feature setting and effective live state for all three. `toggle` with `feature` and `enabled` flips one switch. `usage` accepts `feature` to filter by kind (overview vs chat) and reports billed calls per kind, so the cost of chat is visible on its own.
- Settings use the existing `Setting` collection and the same 60-second cache, so a toggle lands everywhere within about a minute.
- This reuses the existing `manage_ai_overview` grant in `adminAccess`; no new tool and no new permission.

**How switching off reaches the app without an update:**
1. `GET /search/ai-overview/status` returns `{ enabled, followups, chat }`, each already reflecting the switches above (old apps read only `enabled`).
2. The chat endpoint enforces the switch itself: when chat is off it returns `error` event code `chat_disabled` (HTTP 200 stream, so old and new transports treat it the same), and it returns 401 when the caller is not signed in. A stale or cached client can therefore never spend money once chat is off.
3. App behaviour on `chat_disabled`: keep the transcript, show "AI chat is currently unavailable", hide the composer and the entry points, and stop sending.
4. The status query today is asked once per app session (`staleTime: Infinity`). The new app additionally re-checks status each time the chat screen opens and when the app returns to the foreground after 5 minutes, so a disable takes effect within minutes, not at next launch.
5. Later, if cost is too high: an admin runs `manage_ai_overview toggle feature=chat enabled=false`. No release needed. The overview and follow-ups keep working.

**Sign-in behaviour in the app:**
- The chat entry ("Ask a follow-up" pill) is shown to everyone when `status.chat` is true and `isAuthEnabled` is true. Tapping it goes through the existing `useRequireAuth().guard(run, 'ai')`. Signed-out users get the sign-in sheet (reason `ai`, which `SignInScreen` already has copy for), and after signing in the parked action resumes and opens the chat, as votes do today.
- Server side: the route uses `attachUser`, then `requireSignIn` (401 "Sign in to use this feature."), then `aiChatLimiter`, so a forged client gets nothing.
- Chips on the overview card (follow-up SRS) remain anonymous: tapping one just runs a new search.
- The `conversationId` token is bound to the Clerk id, so it cannot be replayed by another account.

### 3.9 Prerequisite: turn authentication on (Phase 0)
Chat cannot ship until sign-in is live in the production app. Findings from the repo:
- `src/config/features.ts` has `isAuthEnabled = false` on master, commented "disabled for Google Play Store review compliance". Sign-in code, `SignInScreen`, `ManageAccountScreen` and the Clerk provider already exist (`@clerk/expo`, publishable key in `app.json`).
- `useRequireAuth` returns without running the action when auth is off (except reports). So today **voting silently does nothing**. Flipping the flag turns voting on for signed-in users and gates it behind sign-in for everyone else. This is a visible side effect of Phase 0, not only chat plumbing.
- The flag is compile-time, so Phase 0 is an app release. Installed builds keep `isAuthEnabled = false`, never show sign-in, and never see chat. That is intended.
- Android R8: `app.json` already carries the Clerk keep rules (`-keep class com.clerk.api.** / com.clerk.ui.**`) for clerk-android#941. The crash was never captured in a trace, so the first auth-on build MUST be smoke-tested as a release build on a real device (launch, sign-in, Google SSO, sign-out) before Play rollout.
- Play policy: an app that lets users create accounts needs an in-app way to delete the account, a web deletion link, an updated Data Safety form and privacy policy. Confirm each against the current Play policy before submitting; the exact wording of the reviewer's earlier objection is not in the repo.
- The server side of auth already exists (`attachUser`, `requireSignIn`, Clerk ids in logs), so no backend work is needed for Phase 0.

### 3.5 App screens and flow
1. `AiOverviewCard` keeps working as today (old behaviour) and gains a follow-up chip list (from the follow-up SRS) plus an "Ask a follow-up" pill.
2. Tapping either opens **`AiChatScreen`**, pushed on the Search stack (so header back returns to the results, same rule as citations in `openAiReference`), seeded with the original query and its overview as the first assistant message.
3. `AiChatScreen`: message list, bottom composer, streamed assistant bubble, follow-up chips under the latest answer, a Stop button while streaming, Retry on error, and a New chat action.
4. Sources: reuse the existing sources bottom sheet and `openAiReference` navigation.
5. Assistant text renders through the existing `NativeContentRenderer` (markdown + LaTeX). While streaming it re-renders at most every ~80 ms, since half-written markdown or LaTeX can flash raw markers, as the existing typewriter comment already notes; the final render on `done` is authoritative.
6. State lives in a `useReducer` inside the screen; nothing is persisted in v1. Leaving the screen aborts the stream.

### 3.6 "Thinking" indicator (from the supplied reference)
The reference is web (`"use client"`, Tailwind, `cn`). Port to React Native with the same behaviour:
- Frames: `["·", "✢", "*", "✶", "✻", "✽"]` forward, then the same list reversed (12 frames), advanced every 120 ms.
- Label "Thinking", with a pulsing "…" until 2 s have passed, then "Thinking · Ns" counting seconds.
- Shown from send until the first `delta` arrives. If `step` events arrive, show the step label in place of "Thinking".
- No new dependency and no Reanimated: two `setInterval`s in `useEffect` with cleanup (as in the reference), `Text` in `FONTS.mono` for the glyph, `COLORS.textMuted` for the label, `Animated` opacity loop for the "…" (the card already uses this pattern in `GeneratingState`).
- Accessibility: `accessibilityRole="progressbar"` plus `accessibilityLiveRegion="polite"` and label "Thinking", matching the reference's `role="status"`, `aria-live`.
- Respect reduce-motion where `AccessibilityInfo.isReduceMotionEnabled()` is true: show a static "Thinking…".
- The same component replaces the current "GENERATING…" skeleton in `AiOverviewCard`'s loading state, so the overview and chat feel like one system.

Sketch of the port:
```tsx
const BASE = ['·', '✢', '*', '✶', '✻', '✽'];
const FRAMES = [...BASE, ...[...BASE].reverse()];

export const ThinkingIndicator = ({ label }: { label?: string }) => {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const id = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 120); return () => clearInterval(id); }, []);
  useEffect(() => { const s = Date.now(); const id = setInterval(() => setElapsed(Math.floor((Date.now() - s) / 1000)), 1000); return () => clearInterval(id); }, []);
  // <Text style={mono}>{FRAMES[frame]}</Text> <Text>{label ?? 'Thinking'}{elapsed > 2 ? ` · ${elapsed}s` : '…'}</Text>
};
```

### 3.7 Client streaming function
- `streamAiChat({ query, conversationId, signal, onEvent })` in `src/api/aiChat.ts`, using `import { fetch } from 'expo/fetch'`.
- Reads `response.body.getReader()`, decodes with `TextDecoder`, splits on blank lines, parses `event:` / `data:` lines, and calls `onEvent`. Tolerates partial chunks.
- Origin comes from the existing `Backend` module. If the connection fails or returns 5xx **before the first byte**, fail over once to the other origin (same rule as `request()`); after the first byte, no retry, surface an error with a Retry button.
- `429` shows the existing cooldown message style; `401` (if sign-in is required) opens the sign-in flow.
- Abort via `AbortController` on Stop, on unmount and on a new turn.
- If streaming is unavailable at runtime (`response.body` missing), fall back to reading the whole SSE body once and replaying the events, so the feature degrades to non-streaming instead of failing.

## 4. Functional requirements
- C1. `POST /search/ai-chat/stream` streams the events in 3.2 and closes the stream after `done` or `error`.
- C2. The first turn creates a Google session; later turns with a valid `conversationId` reuse it, and the answer uses prior context (verified in 2.1).
- C3. Invalid, expired or foreign `conversationId` returns an `error` event with code `bad_conversation`; the app then starts a new conversation transparently.
- C4. `references` are emitted in the existing overview reference shape so the sources sheet and navigation code are reused unchanged.
- C5. The server sets a short-answer preamble ("under 120 words", tunable) and `includeCitations`, `ignoreAdversarialQuery`, `ignoreNonAnswerSeekingQuery` as today.
- C6. Client disconnect aborts the upstream Google request.
- C7. The chat is off (no entry points in the app) unless `/search/ai-overview/status` returns `chat: true` **and** `isAuthEnabled` is true. `chat` reflects the admin switch (3.8).
- C7a. `POST /search/ai-chat/stream` requires sign-in (401 otherwise), is rate limited per account, and refuses with `chat_disabled` when the chat switch, overview switch or env credentials are off, or the daily cap is hit.
- C7b. `manage_ai_overview` accepts `feature` (`overview` | `followups` | `chat`) for `status`, `toggle` and `usage`; omitting it behaves exactly as today.
- C7c. Chat defaults to **off** until an admin enables it. Follow-ups and overview default to on.
- C8. `AiChatScreen` behaviours: streamed text, Thinking indicator until first delta, Stop, Retry, follow-up chips after each answer (tap = send that question as the next turn), New chat, turn cap message, error and offline states.
- C9. `ThinkingIndicator` as specified in 3.6, also used in the overview loading state.
- C10. No new native dependency; JavaScript only, so no prebuild or config-plugin change (AGENTS.md).

## 5. Compatibility with installed apps
- Old apps never call `/search/ai-chat/stream`, so they cannot break.
- The only touched existing route is `/search/ai-overview/status`, which gains two boolean keys (`followups`, `chat`). Old apps read `enabled` only.
- The `manage_ai_overview` tool gains an optional `feature` parameter; existing admin calls without it behave as before.
- Installed apps have `isAuthEnabled = false`, so they cannot sign in and never see chat, even when the server switch is on.
- The new app treats a missing `chat` key as false, so a new app against an old server just shows no chat.
- Server first, app second, same as the follow-up SRS.

## 6. Non-functional requirements
- N1. First visible feedback (Thinking indicator) within 100 ms of send.
- N2. First answer text within 6 s at p95 on a normal mobile connection (measured 4.8 s from a desktop), and the full answer within 10 s at p95.
- N3. Streaming UI stays at 60 fps on a mid-range Android: renders are throttled (3.5), no per-token `setState` storms.
- N4. Memory: at most 10 turns held per conversation.
- N5. Per-turn cost stays within budget: fix the number from the billing SKU before rollout.

## 7. Plan
0. **Phase 0: enable auth (own release).** Flip `isAuthEnabled`, smoke-test the R8 release build on a device, complete the Play checklist in 3.9, ship, and confirm sign-in and voting work in production. Chat work below can proceed in parallel but must not ship first.
1. **Spike 2 (backend only).** Price per turn and per session. Test `sessions/-` auto-create. Measure latency over about 20 real queries and 3-turn conversations. Test rephraser off for turn 1 to cut the pre-text delay. Check a bad or expired session name.
2. **Infra check.** Confirm SSE is not buffered end to end: a throwaway SSE route via Cloudflare to EC2 and to Render, watch chunks arriving in real time from a phone on mobile data.
3. **Backend.** `aiChatService.js`, the route (`attachUser`, `requireSignIn`, limiter), the `ai_chat_enabled` and `ai_followups_enabled` settings, `manage_ai_overview` `feature` parameter, status endpoint keys, `kind` on the usage log, tests (unit for event translation, token signing and switch hierarchy; integration for the SSE route with a mocked Discovery Engine, including 401 and `chat_disabled`).
4. **App.** `ThinkingIndicator`, `streamAiChat`, `AiChatScreen`, card entry points behind `guard(run, 'ai')`, status re-check on chat open, `chat_disabled` handling, tests for the SSE parser (split chunks, CRLF, multi-byte characters).
5. **Rollout.** Deploy the server with chat **off**. Release the app. Admin enables chat with `manage_ai_overview toggle feature=chat enabled=true`. Watch billed calls per kind and error rate for a week. Disabling later needs no release.

## 8. Risks and open questions
| # | Item | Mitigation |
|---|---|---|
| 1 | Cloudflare, EC2 or Render buffering could turn the stream into one burst | Plan step 2 before building; SSE headers and heartbeat; the client fallback replays events so it still works, just not live |
| 2 | Cost grows with multi-turn chat | Sign-in required, limiter, turn cap, admin kill switch (3.8), optional daily cap, per-kind usage stats, cost check in Spike 2 |
| 2a | Enabling auth changes more than chat (voting turns on, Play policy items) | Phase 0 as its own release with a checklist (3.9) |
| 2b | R8 plus Clerk crashed once (build 44) | Keep rules already in `app.json`; release-build smoke test on a real device before rollout |
| 2c | Stale app keeps showing chat after an admin disables it | Server refuses with `chat_disabled`; status re-checked on chat open and foreground |
| 3 | Google session lifetime and quota unknown | Spike 2; signed 24 h token means an expired session becomes `bad_conversation` and a fresh chat |
| 4 | Half-streamed markdown or LaTeX flashes in the bubble | Throttled renders, authoritative final render |
| 5 | Pre-text delay (about 4 s) is mostly Google's rephrase and retrieval, streaming cannot remove it | Thinking indicator with step labels; try rephraser off for turn 1 |
| 6 | Require sign-in for chat? | **Decided: yes.** Overview stays anonymous |
| 7 | **Open:** persist chat history on device? | Assumed no for v1 |
| 8 | **Open:** should the web frontend get the same chat? | Later; the endpoint is client-agnostic |

## 9. Test residue
While researching I made 4 billed Discovery Engine calls and created **one session** on the production engine (`sessions/14956706605406992762`, user `spike-user-1`). It is harmless, and can be deleted through the sessions API if you want the engine clean.

## 10. Implementation status (branch `feat/ai-chat-followups` in both repos, not committed)

Built and verified:
- **Server** (`D:\projects\PYQDECK\server`): `aiChatService.js` (signed conversation tokens, incremental parser for Google's streamed JSON array, session creation, event translation), `POST /search/ai-chat/stream` (sign-in, limiter, switches, in-flight guard, heartbeat, upstream abort), `ai_followups_enabled` and `ai_chat_enabled` settings with the switch hierarchy and optional daily cap, `manage_ai_overview` `feature` parameter, status endpoint keys (now `no-store`), `kind`/`turn`/`followupCount` on the usage log, overview via the Answer API with `relatedQuestions` and automatic fallback to the old Search path. 406 automated tests pass. A live run against the real engine returned a two-turn chat with context carried over.
- **App**: `ThinkingIndicator` (also the overview loading state), shared `SourcesSheet` and `openAiReference`, follow-up chips and the "Ask a follow-up" pill on `AiOverviewCard`, `src/api/aiChat.ts` (streaming client and SSE parser), `AiChatScreen` on the Search stack, status now `{ enabled, followups, chat }` re-read every 5 minutes and on chat open, `isAuthEnabled = true`. TypeScript compiles clean.

Deviations from the text above:
- The first chat turn also sends `about` (the original search). The server folds it into that first question (`"<about> - <question>"`) so "explain that further" has something to refer to. It is ignored on later turns.
- The overview payload's `citations` is `[]` on the Answer path (not forwarded); the card only uses `references`.
- The daily cap counts only successful (`outcome: ok`) chat turns.
- No app automated tests: the app has no test runner. The SSE parser was checked separately at chunk sizes from 1 to 1000 bytes including CRLF.

Not done or not verified:
- No run on a device or emulator; the UI has been type-checked, not seen.
- Phase 0 checklist (3.9) still to do: release-build smoke test, account deletion, Data Safety form, privacy policy.
- Spike 2 items still open: price per turn, session limits, Cloudflare/EC2/Render buffering of the stream.
- Measured latency is noisy (3.5 s to 17 s on the same kind of call across runs).
