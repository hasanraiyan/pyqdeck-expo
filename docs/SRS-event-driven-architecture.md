# SRS: Event-Driven Architecture with Congestion Control (App + Server)

Structured after IEEE Std 830-1998. Companions: `SRS-account-progress-sync-android.md`, `SRS-account-progress-sync-backend.md`, `SRS-unified-cache-layer.md`.

| Field | Value |
|---|---|
| Product | PyQdeck Expo app (`pyqdeck-expo`, v1.10.4, versionCode 86) and backend (`D:\projects\PYQDECK\server`) |
| Feature | One typed in-app event bus, a sync coordinator that merges bursts of events into one request, a shared refresh policy, and server-side coalescing that stays compatible with every released app |
| Document version | 1.0 (draft) |
| Date | 2026-10-12 |
| Status | Draft for review. No code written yet. |
| Hard constraint | **Apps already installed on phones must keep working with no change on their side** (see section 5). |

---

## 1. Introduction

### 1.1 Purpose
Replace the scattered callbacks and listener sets in the app with one event-driven core, and make bursts of events (foreground, network back, ticks, setting changes, push nudges) collapse into as few server requests as possible, without breaking any app version already in users' hands.

### 1.2 Scope
In scope: the app's sync engine and its triggers, the app's refresh of remote config and ad entitlement, screen change notifications, and the server's handling of sync, nudges and rate limiting where they affect congestion.
Out of scope: React Query catalog caching (unchanged), the AI/Persona features, MCP servers, the wire format of any existing endpoint (frozen, section 5), and any other client. The only clients are the Expo app and the backend; there is no other app.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Event | A fact that happened (`progress.changed`), never a command. |
| Bus | The in-process publish/subscribe module. Not a network broker. |
| Coalesce | Fold several events inside a time window into one reaction. |
| Round | One sync cycle: one `POST /api/me/sync` plus any pull pages. |
| Reason set | The set of event kinds that caused a round (`{progress, settings, foreground}`). |
| Old client | Any app build released before this work ships. |
| Wire contract | Request/response shapes, headers, push payload and status/error codes that a client relies on. |

### 1.4 Verified facts about the app (today)

| Area | Fact | Source |
|---|---|---|
| Pub/sub copies | Seven hand-written `Set<fn>` + subscribe + notify implementations: `subscribeProgress`, `subscribeSyncStatus`, `subscribeSettingsApplied`, `subscribeRecents`, `subscribeAppConfig`, `subscribeAdsEntitlement`, backend `subscribe`. | `src/db/syllabusProgress.ts`, `progressSync.ts`, `settingsPending.ts`, `src/utils/recentStudy.ts`, `src/config/appConfig.ts`, `src/utils/adsEntitlement.ts`, `src/api/backend.ts` |
| Single-slot callbacks | `setLocalChangeHandler` and `setSettingChangeHandler` exist only to avoid circular imports. | `syllabusProgress.ts`, `settingsPending.ts` |
| Sync triggers | A tick, a setting change, a recent, app foreground, app background, network back, Study tab open, sign-in, token resume, push nudge (foreground and headless), `refreshFromCloud`, and the engine's own follow-ups all call `requestSync` / `syncNow`. | `src/db/progressSync.ts`, `App.tsx`, `src/background/syncNudgeTask.ts` |
| Lifecycle listeners | Three separate `AppState` listeners (sync, config/ads, backend recheck) plus one Network listener, each acting alone. | `progressSync.ts`, `App.tsx` |
| Debounce | 2 s debounce, 30 s max wait, `immediate` bypasses the debounce. A trigger during a round sets `rerun`, costing a full extra round. | `progressSync.ts:52-142,314-371` |
| Loop guards | `MAX_FOLLOW_UPS = 3`, `adoptTried`, and a `silent` flag on `markSettingPending`, added after the idle-loop bug (commit `66e5052`). | `settingsLogic.ts`, `settingsSync.ts`, `settingsPending.ts` |
| Recents cost | Each `recordRecentStudy` / `recordRecentNote` writes storage, then `markSettingPending('recents')` does a read-modify-write and fires an immediate sync. | `src/utils/recentStudy.ts`, `settingsPending.ts` |
| Refresh | `refreshAppConfig` and `refreshAdsEntitlement` each keep their own `inFlight` and 10-minute throttle, chained by hand in `App.tsx`. | `appConfig.ts`, `adsEntitlement.ts`, `App.tsx:511-519` |
| Screen updates | `subscribeProgress` carries no payload, so each subscriber re-reads AsyncStorage on every notify, once per tick in a burst. | `SyllabusOverviewScreen`, `SemesterSelectScreen`, `SubjectSyllabusScreen` |
| Headless | The background nudge task runs with no React tree and rebuilds the session from Clerk. | `src/background/syncNudgeTask.ts`, `progressSync.ts:380` |
| Client version | App sends no version header on API calls. The server cannot tell old from new clients except by the endpoints they hit. | `src/api/index.ts` |

### 1.5 Verified facts about the server (today)

| Area | Fact | Source |
|---|---|---|
| Event bus already exists | `server/events/bus.js` is an in-process `EventEmitter` wrapper with `on`, `emit`, `drain`; handler errors are swallowed. Events: `sync.completed`, `account.data.changed`, `solution.report.resolved`. Rule: anything that must not be lost stays an awaited call. | `server/events/bus.js` |
| Handlers | `registerEventHandlers()` records sync metrics, sends the "report fixed" push, and schedules sync nudges. | `server/events/handlers.js` |
| Combined sync | `POST /api/me/sync` takes `{progress, settings?, recents?, device?}` and returns `{progress, settings?, recents?}`. Progress errors fail the call; settings/recents errors are reported inside their section. | `services/combinedSyncService.js` |
| Older endpoints still live | `POST /api/me/progress/sync`, `POST /api/me/recents/sync`, `GET/PUT /api/me/settings`, `GET /api/me/progress/summary`, `DELETE /api/me/progress`, `GET /api/me/votes`, `GET /api/me/ads`, `GET /api/me/papers/:subject/:year/pages`, `DELETE /api/me/push-token`. | `routes/meRoutes.js` |
| Nudge | `scheduleNudge` coalesces per account: first change immediately, then at most one more per 30 s window, excluding the originating device when the app sent `device.pushToken`. Payload `data: { type: 'sync' }`, `ttl: 300`, high priority. | `services/syncNudgeService.js`, `notificationService.js:56` |
| Rate limit | `meLimiter`: 60 requests per minute per `clerkId` (IP if none), 429 with `Retry-After: 60` and `code: 'rate_limited'`. Per process, so per origin. | `middleware/rateLimiter.js:58` |
| Kill switches | Flags `syncEnabled`, `settingsSyncEnabled`, `nudgesEnabled`, `adsEnabled`, cached 5 s. Sync paths answer 503 `sync_disabled` when off. | `appConfigService.js`, `meRoutes.js` |
| Limits | `MAX_OPS` 500 per request, `MAX_LIMIT` 1000 items per pull, `MAX_RECORDS_PER_USER` 5000, cursor overlap 30 s, future skew 5 min. | `progressService.js` |
| Failure signals | 503 `sync_unavailable` when Mongo is down; the app fails over to its other origin. | `meRoutes.js` |
| Renamed slugs | `previousSlugs` keeps older apps working after a subject rename. | `progressService.js` |
| Two origins | EC2 and Render run the same code with separate in-memory limiter and nudge state. | `server/server.js` |

### 1.6 Problems this SRS addresses

1. **Foreground burst.** One `AppState→active` fires: sync (`immediate`), config refresh, then ads refresh, then update prompt, then backend recheck, from three separate listeners, with a Network event possibly adding another sync.
2. **`immediate` defeats coalescing.** Several triggers in the same tick merge only by accident (`clearTimer`, `inFlight`). A trigger during a round costs a whole extra round via `rerun`.
3. **Recents are expensive.** Opening one screen can cost a storage write, a pending-settings read-modify-write, and a sync round.
4. **Hand-patched feedback loops.** `MAX_FOLLOW_UPS`, `adoptTried` and `silent` exist because one module's notification could re-trigger another's request. A bus with explicit cause tracking makes this class of bug structural, not patched.
5. **Duplicated plumbing.** Seven copies of the same subscribe/notify code, with inconsistent semantics (payload or none, sync or async).
6. **Payload-less change notices.** Screens re-read storage on every notify, even for a burst of ticks.
7. **Server cannot see old vs new.** No client version signal exists, so any server change must be safe for every shipped build.

---

## 2. Overall description

### 2.1 Product perspective
The app is local-first. Storage is the source of truth on the phone; the account is the source of truth once signed in. Events describe what happened locally or externally; the sync coordinator decides when a network round is worth making. The server's job does not change: it merges and returns, and nudges other devices.

### 2.2 Architecture (target)

```
 producers                          bus                      consumers
 ---------                          ---                      ---------
 setTopicDone ----> progress.changed ----+----> SyncCoordinator ---> syncAll() ---> /api/me/sync
 settings.ts  ----> setting.changed -----+            ^   |
 recentStudy  ----> recents.changed -----+            |   +--> sync.status ---> Settings screen
 Lifecycle    ----> app.foreground ------+            |
  (one AppState,    app.background ------+            |
   one Network)     network.online ------+      reason set + window
 Clerk effect ----> auth.changed --------+
 push listener ---> nudge.received ------+----> RefreshCoordinator ---> app-config, ads entitlement
 pull applied ----> progress.applied ----------> screens (payload: subjectIds)
```

### 2.3 Design rules
1. **Events state facts, not commands.** `progress.changed`, not `please.sync`.
2. **Reactions are not events.** A consumer may emit only events that describe its own result (`sync.status`, `progress.applied`). It must never emit an event that causes itself to run again. This replaces `silent` and `adoptTried` as the primary loop guard; `MAX_FOLLOW_UPS` stays as a backstop.
3. **Lost-on-crash data stays in storage.** Anything that must survive (outbox, pending settings, cursor, wipe journal) remains in AsyncStorage. The bus is in memory only, exactly like the server's, and for the same reason: events are hints, storage is truth.
4. **Awaited paths stay awaited.** `wipeUserData` (journal, then progress, then storage, then cache) remains a direct awaited call. `auth.changed` triggers it; it is not a fire-and-forget handler.
5. **The wire contract is frozen** (section 5).
6. **Headless entry stays explicit.** The background nudge task runs in a fresh JS context, so it calls the coordinator directly. It cannot depend on bus state.

### 2.4 Users and constraints
- Students on Android phones; some on old app builds for weeks or months after a release.
- Two backends (EC2, Render), independent memory, one app choosing between them.
- Offline is normal. Every reaction must tolerate being skipped.

### 2.5 Assumptions (to confirm)
- A1. **Confirmed by the owner:** EC2 and Render share one MongoDB. Data is consistent across origins; only in-memory state (rate limiter, nudge timers, request coalescing) is per process.
- A2. Old clients are mostly 1.1.x to 1.10.x. The combined `/sync` endpoint shipped with commit `b364a12` (2026-10-10); older 1.x builds may still call `/progress/sync`, `/recents/sync` and `/settings` separately. Both stay supported.
- A3. The Cloudflare edge only caches `/api/public/*` GETs; `/api/me/*` is `private, no-store`.

---

## 3. Functional requirements: app

### 3.1 Event bus (EVT)
- **EVT-FR-1** A module `src/events/bus.ts` shall provide `emit(type, payload)`, `on(type, handler)` (returns unsubscribe) and `once`.
- **EVT-FR-2** Event types and payloads shall be one TypeScript map (`EventMap`), so a wrong payload fails at compile time.
- **EVT-FR-3** A handler that throws shall be caught and reported (console in dev, Sentry breadcrumb in release) and shall not stop other handlers or the emitter.
- **EVT-FR-4** Handlers shall run after the emitter continues (microtask), so `setTopicDone` never waits on a consumer.
- **EVT-FR-5** The bus shall hold no state that must survive a restart.
- **EVT-FR-6** In dev builds the bus shall keep a ring buffer (last 200 events) readable from the debug banner, and shall warn if one event type is emitted more than 20 times in one second.
- **EVT-FR-7** A `coalesce` helper shall merge events by policy: `latest` (keep newest), `merge(a, b)`, or `debounce(ms, maxWaitMs)`. The existing pure `nextSendDelay` shall be reused.

Event catalogue:

| Event | Emitted by | Payload |
|---|---|---|
| `app.foreground` / `app.background` | Lifecycle (the only `AppState` listener) | none |
| `network.online` | Lifecycle (the only Network listener) | none |
| `auth.changed` | Clerk effect in `App.tsx` | `{signedIn, userId}` |
| `progress.changed` | `setTopicDone` | `{subjectId}` |
| `progress.applied` | `applyPulledItems` | `{subjectIds[]}` |
| `setting.changed` | `markSettingPending` | `{name}` |
| `settings.applied` | `applyAuxResponse` | none |
| `recents.changed` | `recordRecentStudy/Note` | none |
| `nudge.received` | foreground push listener, headless task | `{via: 'foreground' \| 'headless'}` |
| `sync.status` | SyncCoordinator | `SyncStatus` |
| `config.changed` / `ads.changed` | config and entitlement stores | none |

### 3.2 Lifecycle source (LIF)
- **LIF-FR-1** One module shall own the single `AppState` listener and the single Network listener and publish `app.foreground`, `app.background`, `network.online`.
- **LIF-FR-2** `network.online` shall fire only on a transition to connected and `isInternetReachable !== false`, as today.
- **LIF-FR-3** The three existing `AppState` listeners (`progressSync.ts`, `App.tsx` x2) shall be replaced by bus subscriptions.

### 3.3 Sync coordinator (SYN)
- **SYN-FR-1** `progressSync.ts` shall subscribe to `progress.changed`, `setting.changed`, `recents.changed`, `app.foreground`, `app.background`, `network.online`, `auth.changed`, `nudge.received`. It shall no longer export `setLocalChangeHandler` wiring; `requestSync` remains as a thin compatibility wrapper that emits nothing and schedules.
- **SYN-FR-2** Every event shall add its kind to a **reason set** and (re)start one window. Window rules: base debounce 2 s, max wait 30 s (unchanged), plus a **merge window of 400 ms** for `immediate` reasons so that a foreground, a network return and a nudge arriving together make one round.
- **SYN-FR-3** Reasons carry priority. `app.background` and `auth.changed(signedIn)` flush at 0 ms after the merge window. `progress.changed` and `recents.changed` use the debounce. `setting.changed`, `app.foreground`, `network.online`, `nudge.received` use the merge window only.
- **SYN-FR-4** While a round is in flight, new events shall only add to the **next** round's reason set. The `rerun` flag shall be removed. At most one round is queued behind the running one.
- **SYN-FR-5** `recents.changed` shall be sent without a pending-settings read-modify-write when only recents changed: the coordinator shall treat it as a reason and include the recents section on the next round. `markSettingPending('recents')` shall remain for crash safety but shall not itself trigger a sync.
- **SYN-FR-6** Follow-up rounds shall be an internal reason `followup`, counted by `nextFollowUps`, capped at `MAX_FOLLOW_UPS = 3`, reset by any external reason. The `silent` option shall be kept for old call sites but shall be unnecessary for new ones.
- **SYN-FR-7** A round shall include aux sections (settings, recents) when: first sync on device, a setting is pending, `recents.changed` is in the reason set, or the 60 s minimum gap has passed. Unchanged from today except for recents.
- **SYN-FR-8** `requestSyncOnStudyOpen` (60 s gap) shall remain, emitting through the same coordinator.
- **SYN-FR-9** Failure handling shall be unchanged: 401 pauses until `auth.changed` or foreground; 429 waits `Retry-After`; 503 `sync_disabled` waits 15 min and force-refreshes config; others use `backoffMs`. A backoff timer shall be cancelled and replaced when a new external reason arrives **only if** the failure was not a 429 or `sync_disabled` (never retry sooner than the server asked).
- **SYN-FR-10** `syncFromBackground` shall keep its signature and call the coordinator's `runNow()` directly.
- **SYN-FR-11** `sync.status` shall be emitted on every status change. `subscribeSyncStatus` shall remain as a wrapper for existing screens.

### 3.4 Refresh coordinator (REF)
- **REF-FR-1** One module shall react to `app.foreground` and `auth.changed(signedIn)` by running `refreshAppConfig` then `refreshAdsEntitlement` as one sequence, then the update prompt check.
- **REF-FR-2** Both stores keep their own 10-minute throttle and `inFlight` guard; the coordinator shall not bypass them.
- **REF-FR-3** The sequence shall be skipped entirely when `network.online` has not been seen true since the last failure and the device is known offline.
- **REF-FR-4** `Backend.recheckIfStale` shall be driven by `app.foreground` through the same module.

### 3.5 Screen notifications (UI)
- **UI-FR-1** `progress.changed` events inside one animation frame batch shall be merged into one `progress.applied`-style notice carrying `subjectIds`.
- **UI-FR-2** `subscribeProgress` shall stay as a wrapper. A new `subscribeProgressFor(subjectIds, fn)` shall let a screen ignore unrelated subjects.
- **UI-FR-3** Stores read through `useSyncExternalStore` (config, ads) keep their current hooks; only their notify plumbing moves to the bus.

### 3.6 Migration order (no behaviour change per step)
1. Add bus and tests. Nothing uses it.
2. Lifecycle source; replace the three `AppState` listeners.
3. Move the seven subscribe sets onto the bus behind their current exports.
4. Sync coordinator (SYN-FR-1..11).
5. Refresh coordinator.
6. Payload-carrying progress events for screens.
7. Remove dead code (`rerun`, direct handler slots).

Each step shall leave the app shippable.

---

## 4. Functional requirements: server

The server already has the right shape (bus, combined sync, nudge coalescing). Changes are additive.

- **SRV-FR-1** The new app shall send **`X-App-Version`** (from `expo.version`, e.g. `1.11.0`) and **`X-App-Build`** (`android.versionCode`) on every API request. The server shall read them on `/api/me/*` and `/api/public/app-config`. Absent means "old client". They are recorded in metrics only; no behaviour depends on them in this release. The headers shall be added to the CORS `allowedHeaders` in `server/server.js` (needed for the web build, which preflights non-safelisted headers) **before** the app ships, or web requests will fail.
- **SRV-FR-2** Add per-account **request coalescing for identical pull-only rounds**: if the same `clerkId` sends a progress request with `ops: []` and the same `cursor` twice within 2 s, the second shall be answered from the first's result (same body) without a second Mongo query. This is invisible to clients and protects against old apps that sync on every foreground plus every network event.
- **SRV-FR-3** `meLimiter` shall stay at 60/min per account. A `Retry-After` shall always be sent on 429 (already true). New: the limiter shall count a **coalesced duplicate** (SRV-FR-2) as zero.
- **SRV-FR-4** `scheduleNudge` shall keep its 30 s window and payload. Add a metric for nudges suppressed by coalescing.
- **SRV-FR-5** Add events `request.coalesced` and `nudge.suppressed` to the bus, handled only by metrics (counts, no content, as SRV-FR-32 of the backend SRS).
- **SRV-FR-6** `GET /api/public/app-config` shall gain an optional `syncHints` object: `{ minRoundGapMs, mergeWindowMs }`. New apps use it to tune their windows within safe bounds (min gap 5 s to 5 min; merge window 100 ms to 2 s). Old apps ignore the unknown field (they parse with `sanitizeAppConfig`, which drops unknown keys). **To confirm** against `appConfigLogic.ts` before shipping.
- **SRV-FR-7** Sync metrics (`getSyncMetrics`) shall add `byClientVersion` counts and `coalescedRequests`.
- **SRV-FR-8** No server change shall alter or remove an existing route, field, status code, error code, or push payload (section 5).

---

## 5. Backward compatibility (the hard constraint)

Old builds in the field cannot be updated on demand. The server and the new app must treat the following as **frozen**.

### 5.1 Frozen wire contract

| Item | Frozen behaviour |
|---|---|
| `POST /api/me/sync` | Request `{progress:{cursor,ops,limit}, settings?:{changes?}, recents?:{recentStudy,recentNotes}, device?:{pushToken}}`; response `{progress:{results,items,cursor,hasMore,changedCount?...}, settings?, recents?}`; section errors inside their section. |
| Older routes | `POST /api/me/progress/sync`, `POST /api/me/recents/sync`, `GET/PUT /api/me/settings`, `GET /api/me/progress/summary`, `DELETE /api/me/progress`, `GET /api/me/votes`, `GET /api/me/ads`, `GET /api/me/papers/...`, `DELETE /api/me/push-token`. Must stay mounted and unchanged. |
| Status and codes | 401 `unauthenticated`, 400 `invalid_body` / `invalid_cursor` / `too_large` / `invalid_setting`, 429 `rate_limited` + `Retry-After`, 503 `sync_unavailable`, 503 `sync_disabled`, 500 `server_error`. |
| Push payload | Data-only `{type:'sync'}` with `ttl: 300`, `priority: high`, `_contentAvailable: true`. The headless task matches `"type":"sync"` in the serialised payload. Do **not** add fields that change that match. |
| Limits | `MAX_OPS` 500, `MAX_LIMIT` 1000, `MAX_RECORDS_PER_USER` 5000 may be raised but never lowered. |
| Ids | Subject slug and `previousSlugs` resolution. Topic keys `moduleId:topicId`. Cursor format is opaque but old cursors must still decode. |
| Settings names | `askAiEngine`, `readingLayout`, `volumeScroll`, `syllabusBranch`. New names are additive; an unknown name from a client is ignored (existing behaviour). |
| App config | Existing fields and flag names stay. New fields are additive. |
| Cache headers | `/api/me/*` stays `private, no-store`. |

### 5.2 Compatibility rules
- **COMPAT-1** Server changes are **additive only**: new optional request fields, new optional response fields, new headers.
- **COMPAT-2** An old client sending no `X-App-Version` shall get exactly today's behaviour. Coalescing (SRV-FR-2) is the only server-visible change and returns an identical body.
- **COMPAT-3** *(relaxed by the owner, 2026-10-12)* Both servers are deployed with the latest code at the same moment, so the new app does **not** have to work against the previous server. It still reads every new field with a default (`syncHints`), because that costs nothing.
- **COMPAT-4** *(relaxed)* Rollback of the server is not a supported state for the new app.
- **COMPAT-5** Deploy order: **server first**, then the app build. The server must be live on both origins before the app ships.
- **COMPAT-6** The coordinator shall never send more requests than the old engine would have for the same events. It may send fewer.
- **COMPAT-7** Old clients that sync on every foreground are protected by SRV-FR-2 and the existing 60/min limiter; no new limit shall be tighter than today's for them.
- **COMPAT-8** `minAppVersion` stays an admin tool. This work shall not raise it.

### 5.3 Compatibility test matrix

| Client | Server | Expected |
|---|---|---|
| Old app (current 1.10.4) | New server | Identical behaviour; duplicate pull-only rounds answered from cache. |
| New app | New server | Windows tuned by `syncHints`; metrics show version. |
| Old app, 1.1.x using separate routes | New server | `/progress/sync`, `/recents/sync`, `/settings` unchanged. |
| Headless nudge on old app | New server | Payload unchanged; sync runs. |

---

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Request budget.** For a foreground with nothing pending, the app shall send at most **1** request to `/api/me/sync` and at most 1 each to app-config and ads entitlement (the latter two already throttled to 10 min). Today the same event can send more. |
| NFR-2 | **Burst budget.** Ticking 20 topics within 10 s shall produce at most 2 sync rounds (one at the 30 s max-wait boundary at the latest). |
| NFR-3 | **Idle.** With no user activity, the app shall make 0 sync requests after the follow-up cap (existing guarantee, kept and tested). |
| NFR-4 | **Latency.** A tick shall reach local storage and the screen with no network wait (unchanged). The bus shall add no more than 1 ms per emit on a mid-range phone. |
| NFR-5 | **Memory.** Bus state is handler lists only; the dev ring buffer is excluded from release builds. |
| NFR-6 | **Offline.** Every reaction shall be safe to skip. Losing the bus (process death) loses no data because storage holds the outbox. |
| NFR-7 | **Observability.** Dev ring buffer (EVT-FR-6); server metrics (SRV-FR-7); the existing nudge diagnostics (`recordNudgeRun`) keep working. |
| NFR-8 | **Privacy.** Events and metrics never carry what the student ticked or read, only counts and ids already allowed (backend SRS SRV-FR-32). |
| NFR-9 | **Expo rules.** Use official Expo packages (`expo-network` already used for connectivity). No new native code. Builds stay on the GitHub Actions workflow; never `eas build`. |
| NFR-10 | **No new runtime dependency** for the bus (about 100 lines of TypeScript). |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Headless task has no shared bus state. | Explicit `syncFromBackground` entry (SYN-FR-10). |
| Merge window delays a user-visible sync by 400 ms. | Only for reasons that were already "immediate"; ticks keep their 2 s debounce. |
| Events firing during `wipeUserData` re-create data. | Wipe stays awaited and sets a flag; the coordinator ignores events while `wipeRunning`. Wipe hook resets the reason set. |
| Per-process in-memory state on two origins (coalescing, limiter, nudge timers). | The database is shared, so data is always consistent. Coalescing is best-effort and per process, like the limiter and nudges today. Correctness never depends on it. |
| Hidden coupling when moving 7 stores. | Keep each public `subscribeX` export as a wrapper; migrate behind it. |
| New app misreads `syncHints`. | Clamp to bounds; ignore when invalid. |
| Server header trust. | `X-App-Version` is advisory, used for metrics only. |
| New header breaks web preflight. | Add both headers to `corsBase.allowedHeaders` and deploy the server first (COMPAT-5). |

---

## 8. Acceptance criteria

1. Existing tests pass: `progressLogic`, `settingsLogic`, `appConfigLogic`, `storageRegistry`-related.
2. New tests: bus (order, error isolation, unsubscribe), coalescer (merge, max-wait), coordinator reason-set logic (pure), and a fake-timer test for NFR-1 and NFR-2.
3. Server tests (Vitest): coalesced duplicate returns identical body; old-client request without headers is unchanged; no route removed (snapshot of the router's route list).
4. Manual device pass using `CHECKLIST-account-sync-device-test.md`: two phones, tick on one, nudge, appears on the other.
5. Compatibility matrix (5.3) verified: current release build against the new server.
6. Server deployed before the app; metrics show a drop in requests per active user and no rise in 429s.

---

## 9. Decisions and open questions

Decided (2026-10-12, owner):
1. EC2 and Render share one MongoDB (A1).
2. `X-App-Version` / `X-App-Build` are added now (SRV-FR-1).
3. Clients are the Expo app and the backend only; no Kotlin app exists.

Still open:
1. Merge window: 400 ms, or 250 ms / 1 s?
2. Release scope: migration steps 1 to 4 of 3.6 now, refresh coordinator and screen payload events next release (recommended)?
3. `syncHints` (SRV-FR-6): confirm in `appConfigLogic.ts` that old apps drop unknown config fields.

---

## 10. Implementation status (2026-10-12)

Not committed; sitting in the working trees of `pyqdeck-expo` and `server`.

### 10.1 Done

| Area | What | Where |
|---|---|---|
| Phase 0, server | 24 contract tests an installed app depends on: response shapes, error codes, kill switch, older standalone routes, route table, app-config fields, push payload | `server/tests/integration/contract.legacyClient.test.js` |
| Phase 0, app | Fixture test reading real server answers, ignoring unknown fields | `src/db/serverContract.test.ts` |
| SRV-FR-1 | `X-App-Version` / `X-App-Build` allowed by CORS, counted in metrics, malformed values become `legacy`, label count capped at 50 | `middleware/clientVersion.js`, `server.js`, `events/handlers.js` |
| SRV-FR-2 | Repeated pull-only syncs share one result for 2 s. Only a bare progress pull with no ops. Writes through any route drop it. Failures are not shared. `SYNC_COALESCE=off` disables it | `services/combinedSyncService.js`, `routes/meRoutes.js` |
| SRV-FR-4,5,7 | `request.coalesced`, `nudge.suppressed`, `client.seen` events; metrics `coalescedRequests`, `nudgesSuppressed`, `byClientVersion` | `events/*` |
| SRV-FR-6 | `syncHints { minRoundGapMs, mergeWindowMs }` in app-config, validated 1000-300000 / 100-2000, editable through the admin tool | `appConfigService.js`, `models/AppConfig.js`, `adminMcpServer.js` |
| EVT | Typed bus, microtask delivery, error isolation, dev ring buffer and storm warning | `src/events/bus.ts` |
| LIF | One `AppState` and one Network listener | `src/events/lifecycle.ts` |
| SYN | Sync coordinator: reason set, merge window, minimum gap for lifecycle-only rounds, server pause respected, no `rerun` flag, wipe-safe | `src/events/syncPlan.ts`, `syncScheduler.ts`, `src/db/progressSync.ts` |
| Subscribe sets | progress, settings-applied, recents, app config, ads entitlement, sync status moved onto the bus; public `subscribeX` exports unchanged | `src/db/*`, `src/config/appConfig.ts`, `src/utils/*` |
| REF | App config and ad entitlement refresh driven by one `app.foreground` event | `App.tsx` |
| Version headers | Sent on native builds | `src/api/index.ts` |

Tests: server 663 passing (all existing plus 46 new); app 162 passing; `tsc --noEmit` clean. The app's `npm test` now runs with `scripts/tsResolve.mjs` so test files can import extension-less TypeScript.

### 10.2 Differences from the text above

- **SYN-FR-5** Recents no longer trigger an immediate sync. They are announced as `recents.changed` and wait the 2 s debounce. `markSettingPending('recents')` is kept for crash safety.
- **SYN-FR-7** Unchanged: the round includes settings and recents on first sync, when something is pending, or after 60 s.
- **SRV-FR-3** Dropped. `express-rate-limit` counts a request before the handler runs, so a coalesced duplicate cannot be counted as zero. The 60/min per account limit is far above what the app sends.
- **REF-FR-3** Not done. The two refreshes already fail quietly offline.
- **`auth.changed` event** Not added. `configureSyncSession` stays a direct call; there is no consumer that needs an event.
- **`api/backend.ts`** Left as it was. It is self-contained by design and its subscriber is dev-only.
- **Version headers on web** Not sent, to avoid a CORS preflight on every GET in the web preview. The server accepts them either way.
- **UI-FR (payload-carrying progress events)** Deferred to the next release, as agreed.

### 10.3 Before shipping

1. Deploy the server to both origins (they start on the latest code together).
2. Check `getSyncMetrics()`: `byClientVersion` should show `legacy` for installed apps, and `coalescedRequests` should rise.
3. Build the app through the GitHub Actions workflow, and run the two-phone checklist (`CHECKLIST-account-sync-device-test.md`).
