# SRS: Account-Backed Progress Sync (Backend Server)

Structured after IEEE Std 830-1998. Companion document: `SRS-account-progress-sync-android.md` (client side of the same feature).

| Field | Value |
|---|---|
| Product | PyQdeck backend API (`D:\projects\PYQDECK\server`, GitHub `pyqdeck/server`) |
| Feature | Per-account syllabus progress storage and sync; account-data purge; push-token unlinking; vote lookup |
| Document version | 1.1 (draft) |
| Date | 2026-10-10 |
| Status | Draft for review. No code written yet. |
| Evidence | Verified against the server source at commit `a92cf2f` (stack, routes, models, middleware, webhook, tests). Items still unverifiable from code are marked **to confirm**. |

---

## 1. Introduction

### 1.1 Purpose
Define what the server must provide so the Android app can save a signed-in student's syllabus progress to their account, restore it on another device, and remove it when the account is deleted.

### 1.2 Scope
In scope: authenticated progress endpoints, data model, merge rules, limits, account-data purge, push-token unlinking, a vote-lookup endpoint, fixes to existing server behaviour that this feature depends on, observability, security.
Out of scope: client behaviour (companion SRS), new study features, the AI/Persona features, the MCP servers.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Topic key | `(subject, moduleId, topicId)`. `moduleId` and `topicId` are the string forms of the Mongo subdocument `_id`s inside `SyllabusSubject`. The app uses the subject slug as its subject id. |
| Record | One stored progress state for a topic key and a user. |
| Tombstone | A record with `done = false`, kept so an un-tick reaches other devices. |
| Op | One client change: topic key, `done`, `updatedAt`, `opId`. |
| LWW | Last-write-wins by `updatedAt`. |
| `clerkId` | Clerk user id; `req.clerkId` after `attachUser`. Votes, reports and push-token links already use it (stored in fields named `voterId`). |
| Origin | A deployed instance: EC2 (`ec2-api.pyqdeck.in`, primary) and Render (`api.pyqdeck.in`, fallback). |

### 1.4 Verified facts about the current server

| Area | Fact | Source |
|---|---|---|
| Stack | Node ≥ 22, Express 5, Mongoose 8 (MongoDB), `@clerk/express`, `express-rate-limit`, `zod`, Sentry. Tests: Vitest + `mongodb-memory-server` + supertest with mocked Clerk (227 tests per README). | `package.json`, `README.md` |
| Mounts | `/api/public` (CORS allowlist + `apiLimiter` + public cache headers), `/api/persona`, `/mcp`, `/admin-mcp`, `/api/admin`, `/api/webhooks`, `/api/ping`, `/api/health`. | `server/server.js` |
| Public cache | Every GET under `/api/public` gets `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, and Cloudflare fronts both origins (an admin `clear_cache` tool even purges the edge cache). The Persona router is mounted **outside** `/api/public` precisely because of this. | `server/server.js` comments |
| Auth | `safeClerkMiddleware` (global, fails open) fills `req.auth`. Per route: `attachUser` (finds or creates a `User` by `clerkId`; needs a verified email, else treats the caller as anonymous) then `requireSignIn` (401 `"Sign in to use this feature."`). | `middleware/clerkAuth.js` |
| Identity convention | Writes use `req.clerkId`, never the body (votes, reports). | `routes/publicDataRoutes.js` |
| Rate limits | `apiLimiter` per IP 6000/15 min (sized for Vercel SSR; skipped outside production). `voteLimiter` per IP 30/hour (skipped outside production). `aiLimiter` etc. keyed by `req.clerkId`, not skipped. All use the default in-memory store, so counters are per origin and per process. | `middleware/rateLimiter.js` |
| Errors | `{ message }` JSON; 429 from the limiters; `ApiError`/`ValidationError`/`NotFoundError` mapped by `withNotFoundHandling`. | `routes/publicDataRoutes.js`, `middleware/errorMiddleware.js` |
| Syllabus ids | `SyllabusSubject` embeds `modules[]` and `topics[]` with Mongo `_id`s; the model comment says these are "the stable identity... the app keys its 'done' checkmarks off them". API output uses `id = _id.toString()`; subject `id` is the **slug**. Reads accept a slug or an `_id` string. | `models/SyllabusSubject.js`, `services/syllabusService.js` |
| Sizes | "a subject has ~6 modules of ~5 topics". | model comment |
| Note votes | `NoteVote` unique on `(topicId, voterId)`; totals are computed by aggregation (no stored counters); `GET .../notes/votes` returns `myVote` using `attachUser` but sits under the public cache headers. | `models/NoteVote.js`, `services/noteFeedbackService.js` |
| Solution votes | `SolutionVote` unique on `(solution, voterId)`; counters stored on `Solution`. The solution `GET` does **not** return `myVote`. | `models/SolutionVote.js`, `routes/publicDataRoutes.js` |
| Push tokens | `PushToken { token (unique), platform, voterId, lastSeenAt }`. `registerPushToken` only sets `voterId` when one is sent; it never clears it. | `services/notificationService.js` |
| Account deletion | `POST /api/webhooks/clerk` verifies the Svix signature, then `user.deleted` runs `handleUserDeleted`: removes solution votes and fixes counters, deletes `SolutionReport`s, unsets `PushToken.voterId`, deletes the `User` row. Idempotent; 500 on failure so Svix retries. The website has a `/delete-account` page that promises this. **Not covered:** `NoteVote`, `NoteReport`, `AiOverviewLog` (stores `clerkId`, query, ip), Persona chat data. | `routes/clerkWebhookRoutes.js`, `services/clerkWebhookService.js` |
| Databases | One `MONGO_URI` per deployment. `/api/ping` reports `degraded` (503) when Mongo is not connected. The cache-clear tool fans out to both origins. Both origins are the same code (`ORIGIN_ID` = `ec2` or `render`). Whether both use the **same** Mongo cluster is not stated in the repo. | `server/server.js`, `env.example` |
| Webhook secret | `CLERK_WEBHOOK_SIGNING_SECRET` is required in production; the endpoint is documented as `https://api.pyqdeck.in/api/webhooks/clerk`. Whether the Clerk dashboard actually has it registered cannot be seen from the repo. | `env.example`, `README.md` |
| Legacy | `User` still has unused pre-Clerk fields (`completedQuestions`, `bookmarkedQuestions`, `streakInfo`, `lastJourney`). None relate to syllabus topic progress. | `models/User.js` |

---

## 2. Overall description

### 2.1 Feature summary
Add a small authenticated "progress" API on a **non-cached mount**. The client keeps a local copy and a queue of changes and calls one sync endpoint that accepts changes and returns anything newer than the client's cursor. The server resolves conflicts per topic.

### 2.2 Users
| Class | Interaction |
|---|---|
| Signed-in student app | Calls the sync API. |
| Clerk (Svix) | Sends `user.deleted` to the existing webhook. |
| Admin (MCP tools) | Edits syllabus content; these edits must not destroy students' progress. |
| Operator | Monitors, deploys to both origins. |

### 2.3 Constraints
- CR-1: Only signed-in users may read or write progress. Existing anonymous endpoints stay anonymous (`server.js` states this rule).
- CR-2: Identity comes only from `req.clerkId`. Any user id in a request MUST be ignored.
- CR-3: Existing endpoint contracts MUST NOT change (older app versions stay supported); additions only.
- CR-4: Per-user responses MUST NOT be cacheable by Cloudflare or any shared cache.
- CR-5: Code must run on both origins.

### 2.4 Assumptions
- A1: MongoDB (Atlas or equivalent) supports atomic single-document updates and unique compound indexes (standard).
- A2: The app can be updated to call a new path prefix (see SRV-FR-1; its request helper currently hard-codes `/api/public`).

---

## 3. Specific requirements

### 3.1 Mount, authentication, caching

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-1 | Progress and vote-lookup routes MUST be mounted under `/api/me`, **outside** `/api/public`, with the same `publicCors` allowlist semantics as `/api/persona`. | M |
| SRV-FR-2 | Every response from `/api/me` MUST carry `Cache-Control: private, no-store`. | M |
| SRV-FR-3 | Every `/api/me` route MUST use `attachUser` then `requireSignIn`. Unauthenticated callers get `401` with `code: "unauthenticated"` added to the standard `{ message }` body. | M |
| SRV-FR-4 | The user identity MUST be `req.clerkId`. Body and query fields claiming a user id MUST be ignored. A user MUST only ever read or change their own records. | M |
| SRV-FR-5 | `/api/me` MUST have its own limiter keyed by `req.clerkId` (IP fallback), not skipped outside production. Proposal: 60 requests/minute with burst 10. Over the limit: `429` with `Retry-After`. Values are **TBD**. | M |

### 3.2 Data model

Logical record: one per `(clerkId, subject, moduleId, topicId)`.

| Field | Type | Notes |
|---|---|---|
| `clerkId` | string | From `req.clerkId` |
| `subject` | ObjectId | The `SyllabusSubject._id`, resolved from the slug or id the client sends |
| `moduleId`, `topicId` | string | The module and topic subdocument ids as the app sees them |
| `done` | boolean | `false` is a tombstone |
| `updatedAt` | integer ms | Effective client time after clamping; used for LWW |
| `serverUpdatedAt` | Date | Audit and pull cursor input |

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-6 | Store the subject by `_id`, not by slug, because slugs are editable (`updateSubject` sets `subject.slug`). Accept either a slug or an `_id` string from the client and always return the **current slug** in responses. | M |
| SRV-FR-7 | A unique index MUST exist on `(clerkId, subject, moduleId, topicId)`, plus an index supporting pull by `(clerkId, serverUpdatedAt)`. | M |
| SRV-FR-8 | Implementation note (non-binding): because a subject has about 30 topics, one document per `(clerkId, subject)` holding a map of topic key → `{ done, updatedAt }` is cheaper than one row per topic and matches the repo's embedding convention. The API contract below does not depend on this choice. | C |
| SRV-FR-9 | Tombstones MUST be kept. Compaction needs a re-sync signal; policy **TBD**. | M |
| SRV-FR-10 | Validation: `moduleId` and `topicId` match `^[A-Za-z0-9_.:-]{1,64}$`; `updatedAt` is an integer ≥ 0. The subject MUST exist, otherwise the op is rejected `unknown_subject`. Topic and module ids MUST NOT be validated against the current syllabus (a stale client may send an old id). | M |

### 3.3 Sync endpoint

`POST /api/me/progress/sync`

Request:
```json
{
  "cursor": null,
  "ops": [
    { "opId": "uuid", "subject": "cse5-microprocessors", "moduleId": "66f0...", "topicId": "66f1...", "done": true, "updatedAt": 1760000000000 }
  ],
  "limit": 1000
}
```

Response `200`:
```json
{
  "results": [ { "opId": "uuid", "status": "applied" } ],
  "items": [ { "subject": "cse5-microprocessors", "moduleId": "66f0...", "topicId": "66f1...", "done": true, "updatedAt": 1760000000000 } ],
  "cursor": "opaque",
  "hasMore": false,
  "serverTime": 1760000005000
}
```

`status` is `applied`, `superseded` (a newer record already existed; it appears in `items`), or `rejected` with `code` `unknown_subject`, `invalid_op`, or `quota_exceeded`.

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-11 | The endpoint MUST process `ops` and return changes after the cursor in one round trip. Empty `ops` is a pure pull; a null cursor means "everything". | M |
| SRV-FR-12 | Merge per op: no record, create it. Otherwise the larger `updatedAt` wins; on equal `updatedAt`, `done = true` wins. Replaying the same op MUST be a no-op. | M |
| SRV-FR-13 | The server MUST clamp `updatedAt`: more than 5 minutes ahead of server time becomes server time. | M |
| SRV-FR-14 | The cursor MUST be safe under concurrent writes: a pull MUST NOT skip a row that committed after the cursor was issued. Recommended: cursor on `serverUpdatedAt` with a 30 s overlap re-read (safe because the merge is idempotent). | M |
| SRV-FR-15 | `items` MUST include every change made by other devices after the cursor, and the caller's own changes only if they altered stored state. | M |
| SRV-FR-16 | Pagination: `limit` default and maximum 1000; `hasMore` means call again with the returned cursor. | M |
| SRV-FR-17 | Conditional writes MUST be atomic (compare `updatedAt` and write in one step), so two concurrent syncs from one user cannot both win. | M |
| SRV-FR-18 | One bad op MUST NOT fail the batch. `opId` is echoed in `results`. | M |

### 3.4 Convenience endpoints

| ID | Endpoint | Behaviour | Priority |
|---|---|---|---|
| SRV-FR-19 | `GET /api/me/progress/summary` | `{ subjects: [{ subject, done }] }` counting `done = true` per subject. | C |
| SRV-FR-20 | `DELETE /api/me/progress` | Deletes all of the caller's progress and bumps a per-user `epoch` returned by sync so other devices clear their copy. Format **TBD**. | C |
| SRV-FR-21 | `GET /api/me/votes?subject=<slug>` | Returns the caller's votes for solutions of that subject (`[{ questionId, value }]`) and for its notes (`[{ topicId, value }]`). Replaces the need for a local-only "my vote" mirror and works on a new device. | S |

Why SRV-FR-21 is a separate endpoint: the solution `GET` sits under the public one-hour cache and must stay anonymous, so adding a per-user `myVote` field there would either leak across users or force it uncacheable.

### 3.5 Limits

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-22 | Max 500 ops per request; JSON body limit stays at the existing 1 MB; over 500 ops answers `400` with `code: "too_large"`. | M |
| SRV-FR-23 | Per-user record cap: 5,000 (about 2.5 times a full 8-semester single-branch syllabus of ~2,000 topics). Beyond it, new topic keys are rejected `quota_exceeded`; updates to existing keys still succeed. | S |
| SRV-FR-24 | Malformed JSON or a wrong type for `ops` answers `400`, never `500`. | M |

### 3.6 Syllabus edits must not destroy progress (existing behaviour to fix)

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-25 | `normalizeModules` currently discards ids, so `updateSubject` with `modules` and `updateModule` with `topics` give **every** module and topic in the replaced array a new `_id`. This orphans all student progress and `NoteVote`/`NoteReport` links for those topics. Bulk replace paths MUST preserve ids: an incoming module or topic that carries an `id`/`_id` keeps it; otherwise it MUST match an existing entry by `(module number, title)` and reuse that `_id`. | M |
| SRV-FR-26 | Deleting a topic or module MAY leave progress records in place (they are hidden by the client); a cleanup job MAY remove records whose topic no longer exists after 180 days. **TBD**. | C |
| SRV-FR-27 | A subject slug change MUST NOT lose progress (satisfied by SRV-FR-6). The previous slug SHOULD still resolve (alias) so older apps with a cached syllabus do not get `unknown_subject`. | S |

### 3.7 Account lifecycle and privacy

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-28 | `handleUserDeleted` MUST also delete the user's progress records, `NoteVote` rows and `NoteReport` rows (note totals are aggregated, so no counter repair is needed). | M |
| SRV-FR-29 | `handleUserDeleted` MUST also remove or anonymise `AiOverviewLog` entries for the `clerkId` (it stores the id, the query and the IP) and the result MUST be reported in the handler's return summary. | M |
| SRV-FR-30 | Persona (AI chat) data created for the user MUST be covered by deletion, or the gap documented in the privacy policy. Mechanism **TBD** (data lives with the Persona service). | S |
| SRV-FR-31 | Deletion MUST stay idempotent and keep the existing "500 so Svix retries" behaviour. | M |
| SRV-FR-32 | Progress contents MUST NOT be written to logs, Sentry, or analytics. | M |
| SRV-FR-33 | The Clerk dashboard MUST have the `user.deleted` webhook registered for the production endpoint; this MUST be checked before release (**to confirm**). | M |

Existing policy that this extends (no new decision needed): votes and reports are deleted, and push tokens stay registered for broadcasts but lose the account link.

### 3.8 Push-token unlinking

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-34 | `DELETE /api/public/push-token` (or `/api/me/push-token`) with `{ token }`, authenticated, MUST unset `voterId` on that token while keeping it registered for broadcasts. Idempotent; returns `{ success: true }` even if no link existed. The caller MUST own the link (`voterId === req.clerkId`). | M |
| SRV-FR-35 | The server MUST NOT clear `voterId` merely because a registration arrives without a session. The app registers its token at launch, which can race Clerk's session load, so an anonymous registration from a signed-in user is expected. (A plan to clear on anonymous registration was rejected for this reason.) | M |
| SRV-FR-36 | Registering a token with a different account MUST replace the old link (a token has one `voterId`). This already holds via `$set`. | M |

### 3.9 Multi-origin consistency

| ID | Requirement | Priority |
|---|---|---|
| SRV-FR-37 | Every origin that can answer `/api/me` MUST use the same MongoDB cluster. If an origin cannot (for example its `MONGO_URI` points elsewhere), it MUST answer sync with `503` `code: "sync_unavailable"` so the client backs off instead of writing to a divergent copy. | M |

---

## 4. Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| SRV-NFR-1 | Sync with ≤ 200 ops: p95 ≤ 300 ms server time. Pull of 1,000 records: p95 ≤ 300 ms. Proposals (**TBD**). | S |
| SRV-NFR-2 | Capacity input: about 30 topics per subject, about 8 subjects per semester, about 64 subjects per branch, so a single-branch student has up to about 2,000 records (average far lower). At ~150 bytes per record that is about 300 KB worst case per user. Active-user and sync-frequency numbers are **TBD**. | S |
| SRV-NFR-3 | Auth failures fail closed: if the session cannot be verified, answer `401` (the existing `safeClerkMiddleware` fails open for open routes, which is why `requireSignIn` on every `/api/me` route is mandatory). | M |
| SRV-NFR-4 | Errors follow `{ "message": "<student-readable>", "code": "<machine>" }`; `code` is additive. | M |
| SRV-NFR-5 | Metrics: sync requests, ops by status, rejects by code, p95 latency, 401/429/5xx counts, records per user, purge counts. Logs carry no progress content. | S |
| SRV-NFR-6 | Deploy with no downtime, backward compatible, on both origins. | M |
| SRV-NFR-7 | The in-memory limiter is per process and per origin; this is accepted for now (note for capacity planning). | S |
| SRV-NFR-8 | Tests (Vitest, `mongodb-memory-server`, supertest with mocked Clerk, matching `tests/integration/api.test.js` and `tests/unit/services.clerkWebhook.test.js`) MUST cover: merge table (new, newer, older, equal, tombstone), clamping, cursor stability under concurrent writes, per-op rejection, slug-or-id resolution, auth failure, cross-user isolation, `Cache-Control` header, id preservation in `normalizeModules`, purge idempotency including note votes/reports. | M |
| SRV-NFR-9 | Backups follow the platform schedule; restore test **TBD**. | S |

---

## 5. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| B1 | New user, pull with null cursor | `items: []`, a cursor, `hasMore: false`. |
| B2 | Push 3 new ops | 3 `applied`. |
| B3 | Device 2 pulls | Receives the 3 records. |
| B4 | Same topic: device 1 untick at T+10, device 2 tick at T+5 | Final `done = false`; device 2's op `superseded`. |
| B5 | Equal `updatedAt`, one tick, one untick | `done = true` wins. |
| B6 | Replay the identical request | No state change. |
| B7 | `updatedAt` one hour ahead | Stored as server time. |
| B8 | One of 3 ops has an unknown subject | That op `rejected: unknown_subject`; others `applied`. |
| B9 | 600 ops | `400 too_large`. |
| B10 | No token or expired token | `401 unauthenticated`. |
| B11 | Body contains another user's id | Ignored. |
| B12 | 2,500 records, `limit` 1000 | 3 pages, no duplicates, no gaps. |
| B13 | Response headers of any `/api/me` route | `Cache-Control: private, no-store`. |
| B14 | Subject slug renamed by an admin, then sync with the new slug | Existing records found; responses carry the new slug. |
| B15 | Admin replaces a subject's `modules` using the same titles and numbers | Module and topic `_id`s unchanged; progress intact. |
| B16 | `user.deleted` delivered twice | First purges progress, `NoteVote`, `NoteReport`, solution votes/reports, `AiOverviewLog`, unlinks push tokens; second is a no-op; bad signature returns 400. |
| B17 | `DELETE /push-token`, then a broadcast and an account-targeted push | Broadcast reaches the device; account push does not. |
| B18 | Anonymous `POST /push-token` for a token linked to a signed-in user | Link unchanged (SRV-FR-35). |
| B19 | Fallback origin on a different database | Sync answers `503 sync_unavailable`. |

---

## 6. Questions from the earlier draft and their answers

| # | Question | Answer from the server code |
|---|---|---|
| R1 | Datastore? | MongoDB through Mongoose. Single-document atomic updates and unique compound indexes are enough; no transactions needed. |
| R2 | Are module/topic ids stable? | They are Mongo subdocument `_id`s and survive **targeted** edits (rename a topic or module). They are **regenerated** by bulk replace paths (`updateSubject` with `modules`, `updateModule` with `topics`) because `normalizeModules` drops ids. Subject slugs are editable and the app uses the slug. Fixed by SRV-FR-6 and SRV-FR-25. |
| R3 | Do EC2 and Render share one database? | The repo has one `MONGO_URI` per deployment and no statement either way. Strong indirect evidence: the cache-clear fan-out and the Mongo-aware `/api/ping` only make sense with shared data. **Still to confirm** by comparing `MONGO_URI` on both hosts; SRV-FR-37 covers the risk. |
| R4 | Does the solution endpoint return `myVote`? | No. It is under the public cache and anonymous. Note votes do return `myVote` (also under the public cache, see 7.4). Added `GET /api/me/votes` (SRV-FR-21). |
| R5 | Vote/report retention on account deletion? | Already decided in code: delete votes (and fix counters) and reports; keep push tokens without the account link; delete the `User` row. This SRS extends it to progress, note votes, note reports, AI logs (SRV-FR-28 to SRV-FR-30). |
| R6 | Rate limit numbers? | Existing limiters are per IP (apiLimiter) or per `clerkId` (AI limiters). Proposed 60/min per `clerkId` for `/api/me`; confirm. |
| R7 | Tombstone compaction? | Not needed at current sizes; keep tombstones (SRV-FR-9). |
| R8 | Is the Clerk webhook registered? | The handler and secret handling exist. Registration in the Clerk dashboard cannot be verified from code; **still to confirm** (SRV-FR-33). |

## 7. Existing problems found while exploring (outside the new feature, relevant to it)

1. **Bulk syllabus edits regenerate ids** (SRV-FR-25). Today this already wipes student checkmarks and note-vote links without any warning; the app then prunes the orphans.
2. **Account deletion is incomplete** (SRV-FR-28 to SRV-FR-30). The website promises removal; `NoteVote`, `NoteReport` and `AiOverviewLog` remain.
3. **Push token keeps the old account link after sign-out** (SRV-FR-34).
4. **`GET .../notes/votes` returns a per-user `myVote` under public cache headers.** If the Cloudflare cache rule for `/api/public/*` is active, one user's `myVote` can be served to another. Recommend adding `Cache-Control: private, no-store` on that route, or moving it to `/api/me` in a later version.
5. **Rate limits are per process and some are skipped outside production** (SRV-NFR-7).
6. **Unused legacy `User` fields** (`completedQuestions`, `bookmarkedQuestions`, `streakInfo`, `lastJourney`) from the pre-Clerk era. They are not used for syllabus progress and should not be reused for it.

## 8. Traceability

| Client requirement (companion SRS) | Server requirement |
|---|---|
| AND-FR-8 to AND-FR-13 (outbox, batches, retry, 401/429/5xx) | SRV-FR-11 to SRV-FR-18, SRV-FR-22, SRV-FR-5 |
| AND-FR-16 (call path and auth) | SRV-FR-1 to SRV-FR-4 |
| AND-FR-17 to AND-FR-19 (first-sign-in merge) | SRV-FR-11, SRV-FR-12, SRV-FR-16 |
| AND-FR-25, AND-FR-44 (push-token unlink and re-register) | SRV-FR-34 to SRV-FR-36 |
| AND-FR-6, AND-FR-45 (orphans, subject slug) | SRV-FR-6, SRV-FR-25, SRV-FR-27 |
| AND-FR-40 (vote highlights from server) | SRV-FR-21 |
| AND-FR-41, AND-FR-42 (privacy, account deletion) | SRV-FR-28 to SRV-FR-33 |
| Origin consistency | SRV-FR-37 |
| AND-NFR-2 (pull volume) | SRV-FR-16, SRV-NFR-1, SRV-NFR-2 |

## 9. Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 (draft) | 2026-10-10 | Initial draft from the client contract |
| 1.1 (draft) | 2026-10-10 | Verified against the server source: new `/api/me` mount (public cache issue), slug and id findings, webhook gaps, push-token race, `GET /api/me/votes`, answers to open questions |
