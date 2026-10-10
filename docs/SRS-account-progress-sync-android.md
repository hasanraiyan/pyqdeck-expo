# SRS: Account-Backed Progress Sync and Sign-Out Data Wipe (Android App)

Structured after IEEE Std 830-1998. Companion document: `SRS-account-progress-sync-backend.md` (server side of the same feature).

| Field | Value |
|---|---|
| Product | PyQdeck mobile app (`pyqdeck-expo`), Android first |
| Feature | Sync syllabus progress to the user's account; clear all local user data on sign-out |
| Document version | 1.0 (draft) |
| Date | 2026-10-10 |
| Status | Draft for review. No code written yet. |
| Supersedes | `SRS-pyqdeck-app.md` FR-34 and NFR-11 (progress is device-only) |
| Depends on | Backend endpoints in `SRS-account-progress-sync-backend.md` (v1.1, verified against the server repo) |

---

## 1. Introduction

### 1.1 Purpose
Accounts now exist (Clerk), so progress no longer has to be device-only. This SRS defines how the Android app:

1. Saves the signed-in student's syllabus progress to their account and restores it on any device.
2. Removes every piece of user data from the device when the student signs out, so the next person to use the phone starts clean.

### 1.2 Scope
In scope: progress storage format, sync engine, sign-in merge, sign-out wipe, related UI, privacy and store-compliance changes on the client.
Out of scope: backend implementation (see companion SRS), new study features (bookmarks, streaks, goals), iOS-specific work, web build behaviour (it must not break).

### 1.3 Current state (verified in code)

| Area | Today | Source |
|---|---|---|
| Progress storage | One AsyncStorage key per subject, `syllabus_done_<subjectId>`, value = JSON array of `moduleId:topicId` strings. No timestamps. | `src/db/syllabusProgress.ts`, `topicKey()` in `SubjectSyllabusScreen.tsx`, `TopicNotesScreen.tsx` |
| Progress readers/writers | `SubjectSyllabusScreen` (tick, prune), `TopicNotesScreen` (tick, read-modify-write of the whole set), `SyllabusOverviewScreen` and `SemesterSelectScreen` (`getDoneCounts`) | grep of `getDoneTopics` / `saveDoneTopics` |
| Orphan pruning | `pruneOrphanedDoneTopics` **deletes** done keys that are not in the currently loaded syllabus. The syllabus can come from the offline cache. | `SubjectSyllabusScreen.tsx:106-111` |
| Sign-out in Settings | `handleSignOut` calls Clerk `signOut()` only. **Nothing local is cleared.** | `SettingsScreen.tsx:137-142` |
| Sign-out elsewhere | Clerk's native `UserProfileView` has its own sign-out and account deletion; the app only pops the route afterwards. | `ManageAccountScreen.tsx` |
| "Clear cached data" | Removes React Query cache and every AsyncStorage key starting `pyq_`. Leaves progress, recents, votes. | `db/cacheService.ts:19-36`, `queryClient.ts:82-87` |
| Per-user data that survives sign-out today | progress (`syllabus_done_*`), `pyqdeck:recent_study`, `pyqdeck:recent_notes`, vote highlights `pyqdeck:vote:*`, `selected_syllabus_branch`. `pyq_recent_searches` is cleared only by "Clear cached data". | key inventory below |
| Push token | Registered authed, so the server links it to the account. Never unlinked. | `registerPushToken`, `api/index.ts:300-306` |
| Analytics identity | No user id is sent to Firebase or Sentry. | grep of `setUserId` / `setUser` |

Consequence: on a shared phone, user B can see user A's progress, recents, vote highlights and (server-side) still receives A's account pushes. This SRS fixes that.

### 1.4 Local storage inventory and target category

| Key / store | Holds | Category after this feature |
|---|---|---|
| `syllabus_done_<subjectId>` (v1), new v2 store | Progress | **User data** (synced, wiped on sign-out) |
| `pyqdeck:recent_study`, `pyqdeck:recent_notes` | Jump Back In | **User data** (wiped) |
| `pyqdeck:vote:<subjectId>:<questionId>`, `my_solution_votes_v2` | My-vote highlights | **User data** (wiped) |
| `pyq_recent_searches` | Search history | **User data** (wiped) |
| `selected_syllabus_branch` | Chosen branch | **User data** (wiped) |
| `pyq_rq_cache` and other `pyq_*` | Cached catalogue, solutions, syllabus, notes | **Cache** (wiped on sign-out) |
| `volume_scroll_enabled`, `old_ui_enabled`, `question_layout_chosen`, `sidebar_collapsed`, `list_pane_collapsed`, `ask_ai_engine`, `volume_scroll_hint_seen` | Device preferences | **Device setting** (kept) |
| `pyqdeck:onboarded`, `interstitial_*`, `review_prompt_*`, `pyqdeck:backend_origin`, `pyq_cache_migrated_rq` | App housekeeping | **Device setting** (kept) |
| Clerk token cache | Session | Owned by Clerk (`signOut`) |
| New: `pyqdeck:owner`, `pyqdeck:progress_outbox`, `pyqdeck:progress_cursor`, `pyqdeck:wipe_pending` | Sync bookkeeping | **User data** (wiped, except the journal flag, which is cleared last) |

---

## 2. Overall description

### 2.1 Feature summary
Local-first sync. Every tick is written to the device immediately and queued; a background engine sends queued changes to the server and pulls changes made on other devices. Signed-out use is unchanged and works with no network. Sign-out wipes user data.

### 2.2 User classes
| Class | Behaviour |
|---|---|
| Signed-out student | Progress stays on the device only, as today. |
| Signed-in student | Progress syncs across devices. |
| Student on a shared or handed-down phone | Signs out and expects no trace of the previous account. |
| Student who reinstalls or changes phone | Signs in and sees progress restored. |

### 2.3 Design decisions (made in this draft, open to change)

| # | Decision | Reason |
|---|---|---|
| D1 | Per-topic records with timestamps; last write wins; "un-tick" is kept as a record (tombstone) so it syncs. | A bare set cannot tell "not ticked yet" from "unticked on purpose". |
| D2 | First sign-in **merges** anonymous local progress into the account (union; where both sides have a record, the newer timestamp wins). | Students have already ticked topics before signing in; losing them would feel like a bug. |
| D3 | Sign-out wipes user data **and** the cache. Device preferences and housekeeping keys stay. | "Clear complete data" for privacy, without re-showing onboarding or resetting ad/review counters. |
| D4 | The wipe is triggered by the **auth state change**, not by the Settings button. | Sign-out and account deletion also happen inside Clerk's native profile view, and sessions can be revoked remotely. |
| D5 | Settings-initiated sign-out first tries to flush unsynced changes, and warns if it cannot. | Avoid silent data loss. |
| D6 | Progress stored in a registry-driven layer: every storage key must declare a category. | Stops future keys from leaking across accounts. |
| D7 | The push token is unlinked from the account before sign-out. | Otherwise account notifications keep arriving on the device. |
| D8 | A "Sync progress" toggle (default on) lets a signed-in student keep progress local only. | Progress now leaves the device; give a choice. |

### 2.4 Constraints
- CR-1: No new native modules unless an Expo package cannot do it (`AGENTS.md`). Needed: `expo-network` (already a dependency) for connectivity; AsyncStorage (already used).
- CR-2: Builds are made by GitHub Actions; no EAS.
- CR-3: Signed-out use of every screen must keep working with no account and no network.
- CR-4: Feature flag `isAuthEnabled` off MUST disable sync and leave behaviour as today.
- CR-5: The web build must still compile; sync may be a no-op there.

### 2.5 Assumptions
- A1: The backend provides the endpoints in the companion SRS before the client ships the sync engine.
- A2: Topic identity is `(subject slug, moduleId, topicId)`. Verified on the server: module and topic ids are Mongo subdocument `_id`s that survive renames but are regenerated by bulk "replace modules/topics" admin edits, and subject slugs are editable. The backend SRS fixes both (SRV-FR-6, SRV-FR-25); until then, progress can be orphaned by an admin bulk edit (see AND-FR-6).
- A3: Clerk reports a definitive signed-in or signed-out state once `isLoaded` is true, including on an offline cold start. **To be verified on a device** (see risk R1).

---

## 3. Specific requirements

### 3.1 Local progress store (v2)

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-1 | Progress MUST be stored per topic as `{ key, done, updatedAt }` where `key = moduleId:topicId`, grouped per subject, in a new versioned store. | M |
| AND-FR-2 | A tick or un-tick MUST write locally first, update the UI immediately, and not wait for the network. | M |
| AND-FR-3 | The v1 data (`syllabus_done_<subjectId>` arrays) MUST be migrated on first launch of the new version: each key becomes `{ done: true, updatedAt: 0 }`. The v1 key MUST be removed only after the v2 write succeeds. | M |
| AND-FR-4 | The store API MUST expose `setTopicDone(subjectId, key, done)` so screens no longer rewrite a whole set. `TopicNotesScreen`'s read-modify-write of the full set MUST be replaced to avoid lost updates between screens. | M |
| AND-FR-5 | `getDoneTopics` and `getDoneCounts` MUST keep their current behaviour for callers (done set, per-subject counts) so the syllabus screens need minimal change. | M |
| AND-FR-6 | `pruneOrphanedDoneTopics` MUST stop deleting records. Records not present in the loaded syllabus MUST be excluded from counts and display, not removed. | M |
| AND-FR-7 | Counts MUST only include keys that exist in the loaded syllabus, so a stale cached syllabus cannot produce counts above the topic total. | S |

Why AND-FR-6: pruning against an offline or stale syllabus would delete real progress, and once records sync, a prune would also turn into server-side deletes.

### 3.2 Sync engine

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-8 | Every local change MUST be appended to a persisted outbox, coalesced per topic (last change wins), so it survives app kills. | M |
| AND-FR-9 | The engine MUST run only when: signed in, `isAuthEnabled`, the Sync toggle is on, and the device is online. | M |
| AND-FR-10 | Sync triggers: right after sign-in; app returns to foreground; 2 s after the last tick (debounced); connectivity regained; opening the Study tab (at most once per 60 s); the "Sync now" action. | M |
| AND-FR-11 | A sync round MUST push the outbox in batches of at most 200 changes, then pull changes since the stored cursor, then apply them locally where the server record is newer. | M |
| AND-FR-12 | Each change MUST carry a client-generated `opId` so a retried request is idempotent. | M |
| AND-FR-13 | On `401` the engine MUST pause and keep the outbox. It MUST NOT wipe data. On `429` it MUST wait for `Retry-After`. On `5xx`/network error it MUST retry with exponential backoff (start 5 s, cap 15 min). Origin failover stays in the existing `request()` layer. | M |
| AND-FR-14 | When pulled changes alter data for a screen that is open, that screen MUST refresh without a manual reload. | S |
| AND-FR-15 | The engine MUST NOT block rendering or taps; all work is off the interaction path. | M |
| AND-FR-16 | Sync MUST use the Clerk token only on the sync endpoints, via the existing authed request helper. Other endpoints stay anonymous (existing rule in `auth/token.ts`). The helper currently builds every URL as `<origin>/api/public<path>`; sync endpoints live under `/api/me` (a non-cached mount), so the request layer MUST gain a way to target `/api/me` while keeping origin failover. | M |
| AND-FR-16a | The client MUST handle per-op results: `applied` and `superseded` leave the outbox; `rejected: invalid_op` is dropped and reported to Sentry without content; `rejected: unknown_subject` is kept locally but removed from the outbox after the next syllabus refresh fails to resolve the subject; `rejected: quota_exceeded` stops further new keys and keeps data local. `503 sync_unavailable` is treated like a network failure (backoff). | M |

### 3.3 First sign-in merge

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-17 | On the first sync for an account on this device (no cursor), the client MUST pull the full server state first, then merge: for each topic, keep the record with the newer `updatedAt`; records with `updatedAt = 0` (migrated v1) lose to any server record and are pushed only if the server has none. | M |
| AND-FR-18 | After the merge the merged result MUST be written locally and any local-only records MUST be pushed. | M |
| AND-FR-19 | The device MUST record the account id as owner (`pyqdeck:owner`) at the first sync. | M |

### 3.4 Sign-out and data wipe

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-20 | A single function `wipeUserData()` MUST remove every key categorised as **User data** or **Cache** in section 1.4, clear the in-memory React Query cache and its persisted copy, clear the pending sign-in action, and reset in-memory screen state that mirrors the removed data (recents, vote highlights, progress). | M |
| AND-FR-21 | `wipeUserData()` MUST be idempotent and MUST use a journal flag (`pyqdeck:wipe_pending`) set before it starts and cleared after it finishes. If the flag is found at launch, the wipe MUST be re-run **before** any screen reads user data. | M |
| AND-FR-22 | The wipe MUST run on the auth state change signed-in to signed-out (after `isLoaded`), whatever caused it: Settings, Clerk's native profile view, account deletion, or a revoked session. | M |
| AND-FR-23 | The wipe MUST also run at launch when Clerk reports signed out (`isLoaded`) but `pyqdeck:owner` is set (the session ended while the app was closed). | M |
| AND-FR-24 | The wipe MUST also run before a merge when a different account signs in and `pyqdeck:owner` belongs to someone else (for example the app was killed during sign-out). | M |
| AND-FR-25 | The Settings sign-out flow MUST be: confirm dialog; if the outbox is not empty, try to flush for up to 5 s; if changes remain unsynced, show a second warning with the count and "Sign out anyway" / "Cancel"; unlink the push token (best effort, 3 s); call `signOut()`; the wipe then runs through AND-FR-22. | M |
| AND-FR-26 | After the wipe the app MUST return to the root of the Browse tab with no stale detail screen showing the previous user's data. | M |
| AND-FR-27 | The confirm dialog MUST say what is removed ("Progress, history and downloaded content on this device will be removed. Your progress stays saved to your account.") and what is kept. | M |
| AND-FR-28 | Device preferences and housekeeping keys (section 1.4) MUST be kept so the next launch does not repeat onboarding or reset ad and review counters. | M |
| AND-FR-29 | A failure in one wipe step MUST NOT stop the remaining steps; the failure MUST be reported to Sentry without user data, and the journal flag MUST stay set so the wipe retries. | M |
| AND-FR-30 | On web, the wipe MUST also clear `localStorage` keys the app owns. | S |

### 3.5 Storage registry

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-31 | One module (`src/db/storageRegistry.ts`) MUST list every AsyncStorage key or prefix the app owns with its category (`user`, `cache`, `device`). Code that adds a key MUST register it. | M |
| AND-FR-32 | `wipeUserData()` MUST be driven by the registry. Keys that are in storage but unregistered MUST be reported (dev warning) and treated as **user data** for wiping. | S |
| AND-FR-33 | A unit test MUST fail when a source file calls `AsyncStorage.setItem` with a key that is not registered. | S |

### 3.6 User interface

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-34 | Settings MUST show, for signed-in users, a "Sync progress" toggle (default on), the last sync time, and a "Sync now" row. Turning sync off stops the engine and leaves local data in place. | M |
| AND-FR-35 | The Study screens MUST show a small sync state (synced, syncing, offline with N pending). It MUST be unobtrusive and not shift layout. | S |
| AND-FR-36 | Signed-out users on the Study tab MUST see a dismissible, non-blocking hint: "Sign in to back up your progress". Dismissal MUST be remembered per device (device setting). | S |
| AND-FR-37 | Settings copy that says progress never leaves the device MUST be updated. | M |
| AND-FR-38 | "Clear cached data" MUST keep its current meaning (cache only) and MUST NOT remove synced progress. | M |

### 3.7 Related per-user data (same wipe, optional sync)

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-39 | Jump Back In records (`recent_study`, `recent_notes`) SHOULD sync across devices through the same engine in a later phase. Until then they are wiped on sign-out. | C |
| AND-FR-40 | My-vote highlights SHOULD be restored from the server through `GET /api/me/votes?subject=` (backend SRV-FR-21), so the local mirror becomes a cache that is safe to wipe and a new device shows the right highlights. The solution `GET` cannot carry `myVote`: it is anonymous and publicly cached. | S |
| AND-FR-44 | After sign-in the app MUST register the push token again with the Clerk token attached, and before sign-out it MUST unlink the token (`DELETE push-token`, backend SRV-FR-34). Today the token is registered once at launch and can race Clerk's session load, so a signed-in device may be registered anonymously and never linked; and nothing unlinks it at sign-out. | M |
| AND-FR-45 | The client sends the subject **slug** (its current subject id). It MUST tolerate the slug changing: the server resolves by internal id and returns the current slug, and the store MUST re-key local records when a pulled item carries a different slug for a known subject. | S |

### 3.8 Privacy and compliance (client side)

| ID | Requirement | Priority |
|---|---|---|
| AND-FR-41 | The privacy policy and the Google Play Data Safety form MUST be updated: signed-in progress is collected and linked to the account. | M |
| AND-FR-42 | In-app account deletion (Clerk's native view) MUST lead to a full local wipe via AND-FR-22. The server purge is specified in the backend SRS. | M |
| AND-FR-43 | The app MUST NOT send user ids or progress contents to Firebase Analytics or Sentry. Event names MAY count sync outcomes without identifiers. | M |

---

## 4. Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| AND-NFR-1 | A tick MUST appear in the UI within one frame and be persisted locally within 100 ms. | M |
| AND-NFR-2 | A steady-state sync round (no changes) MUST be one request. A user with 5,000 records MUST reach full local state in at most 5 pull requests of 1,000. Numbers are proposals (**TBD**). | S |
| AND-NFR-3 | The wipe MUST finish in under 2 s on a mid-range device with a 2 MB persisted cache. | S |
| AND-NFR-4 | The sync engine MUST tolerate being killed at any point without losing a queued change or corrupting the local store. | M |
| AND-NFR-5 | Sync MUST NOT run on every keystroke-like event: at most one in-flight round at a time, debounce 2 s. | M |
| AND-NFR-6 | Data sent MUST be limited to subject id, module id, topic id, done flag, timestamp, op id. | M |
| AND-NFR-7 | Sign-out and the wipe MUST work offline. | M |
| AND-NFR-8 | Pure logic (merge, outbox coalescing, wipe plan, registry check) MUST have unit tests run by `npm test` (`node --test`, as for `layout.test.ts`). | M |

---

## 5. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| T1 | Signed out, tick 3 topics, app killed, reopen | 3 ticks remain; nothing sent to the server. |
| T2 | Signed out with 3 ticks, sign in to an account with 5 other ticks | 8 ticks locally and on server (union). |
| T3 | Device A ticks topic X; device B opens Study tab | B shows X ticked after the next sync. |
| T4 | Device A unticks X at 10:00; device B ticked X at 09:00 | X unticked on both (newer wins). |
| T5 | Offline: tick 2 topics, go online | Both appear on the server; one request. |
| T6 | Settings sign-out, all synced | Dialog; wipe; app at Browse root; progress, recents, vote highlights, search history, cache all empty; preferences and onboarding flag kept. |
| T7 | Settings sign-out offline with 2 unsynced ticks | Warning with count; "Cancel" keeps session; "Sign out anyway" signs out and wipes. |
| T8 | Sign out inside Clerk's profile view | Same wipe as T6 occurs without using the Settings button. |
| T9 | Delete account inside Clerk's profile view | Local wipe occurs; server data purged (backend SRS). |
| T10 | Kill the app mid-wipe, reopen | Wipe completes before any screen reads user data. |
| T11 | User A signs out, user B signs in on the same phone | B sees none of A's progress, recents, votes, searches, or pushes. |
| T12 | Syllabus fetched from an old offline cache lacks a topic the user ticked | The tick is kept; counts exclude it until the topic reappears. |
| T13 | Sync toggle off | No sync requests; local ticks still work; wipe on sign-out still runs. |
| T14 | `isAuthEnabled = false` | Behaviour identical to today. |

---

## 6. Risks and open questions

| # | Item | Owner |
|---|---|---|
| R1 | Offline cold start with a cached Clerk session: confirm Clerk never reports signed-out while only offline, otherwise AND-FR-23 would wipe a signed-in student's unsynced progress. Test on a device before shipping the wipe-at-launch rule. | Engineering |
| R2 | **Answered from the server code:** ids are stable for targeted edits but regenerated by bulk "replace modules/topics" admin edits; slugs are editable. Backend SRS SRV-FR-6 and SRV-FR-25 fix this. Until the server change ships, an admin bulk edit still orphans progress, so AND-FR-6 (never delete orphans) is essential. | Backend |
| R3 | Should Jump Back In sync in this release (AND-FR-39)? | Product |
| R4 | Should the cache be wiped on sign-out (decision D3)? Wiping removes offline content for the next signed-out user until it re-downloads. | Product |
| R5 | Unsynced changes are lost when a session ends elsewhere (revoked, deleted account). Accepted; confirm. | Product |
| R6 | **Answered:** the solution response does not return `myVote` and cannot (public cache). Use the new vote-lookup endpoint (AND-FR-40). | Backend |
| R7 | The two origins share code; whether they share one MongoDB cluster is not stated in the server repo (strong indirect evidence they do). Compare `MONGO_URI` on both hosts. The server returns `503 sync_unavailable` if not (backend SRV-FR-37). | Backend |
| R9 | Clerk dashboard must have the `user.deleted` webhook registered; the server handler exists but registration cannot be checked from code (backend SRV-FR-33). | Product |
| R8 | Multiple Clerk sessions on one device: not supported in the app today; confirm. | Engineering |

---

## 7. Traceability to code (expected touch points)

| Area | Files |
|---|---|
| Progress store, migration, outbox | `src/db/syllabusProgress.ts`, new `src/db/progressSync.ts`, new `src/db/storageRegistry.ts` |
| Screens | `SubjectSyllabusScreen.tsx`, `TopicNotesScreen.tsx`, `SyllabusOverviewScreen.tsx`, `SemesterSelectScreen.tsx` |
| Sign-out and wipe | `SettingsScreen.tsx` (`handleSignOut`), `App.tsx` (auth-edge effect, boot journal check), new `src/auth/wipeUserData.ts` |
| Existing stores to register | `utils/recentStudy.ts`, `utils/votes.ts`, `utils/settings.ts`, `screens/SearchScreen.tsx`, `db/cacheService.ts`, `api/queryClient.ts` |
| API | `src/api/index.ts` (new sync calls, push-token unlink) |
| Copy and compliance | Settings text, privacy policy page, Play Data Safety form |

## 8. Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 (draft) | 2026-10-10 | Initial draft |
