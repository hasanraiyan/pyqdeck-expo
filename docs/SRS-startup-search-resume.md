# SRS: Faster Startup, Uniform React Query Data Flow, and Resume Studying

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Component | App boot (`App.tsx`, `src/api/backend.ts`, `src/api/index.ts`), search, all-subjects, topic notes, question list, home |
| Status | Draft, awaiting approval |
| Follows | `SRS-unified-cache-layer.md` (React Query + persisted cache, already implemented) |
| Source | Production audit findings C1, C2, H3, H4 and H5 (resume part only) |

## 1. Introduction

### 1.1 Purpose
Make the app reach useful, ad-carrying content sooner while online, finish moving every remaining network call onto React Query, and let a student jump back to the last paper and question they were reading.

### 1.2 Product context
PyQDeck earns revenue only while a student is online and viewing ads. Therefore:
- Speed of first online content and number of screen views per session matter more than deep offline support.
- A full offline experience (explicit paper downloads, splitting or enlarging the persisted cache) is **out of scope**. The existing persisted React Query cache stays exactly as it is.

### 1.3 Scope

| ID | Item | Type |
|---|---|---|
| R1 | Take the backend health check off the critical path of the first request | Client |
| R2 | Do not run user-facing startup prompts during onboarding | Client |
| R3 | Prefetch subject meta and default questions when a subject is opened | Client |
| R4 | Move search and every remaining raw fetch onto React Query | Client |
| R5 | "Continue where you left off": last paper and question | Client |

### 1.4 Out of scope
- **Home N+1 (audit H2).** Fixing the 1 + N subjects requests needs a backend change (`subjectCount` on `/semesters`). This document makes no change to `HomeScreen` data fetching. Recorded as a backend follow-up (section 9).
- Offline downloads, cache splitting, bookmarks, dark mode, accessibility pass, bundle trimming, CI gate.
- Any change to the ad policy in `src/utils/ads.ts`.

### 1.5 Constraints
- Expo SDK 57. Follow AGENTS.md: prefer Expo packages, no `eas build`, no native code. Everything here is JavaScript only, so no config plugin or prebuild change is needed.
- Confirm any Expo API used against https://docs.expo.dev/versions/v57.0.0/ before writing it.
- Keep the existing `qk` key module as the only place keys are built.

## 2. R1: Backend health check off the critical path

### 2.1 Current behaviour (verified)
`request()` in `src/api/index.ts` starts with `await Backend.ready()`. `ready()` in `src/api/backend.ts` runs `choose()`, which pings `ec2-api.pyqdeck.in/api/ping` and then, if that fails, `api.pyqdeck.in/api/ping` (4 s timeout each). No data request is sent until that finishes. The source comment records a cold ping of about 3.5 s and a warm one of about 330 ms.

### 2.2 Requirements
- R1.1 The first data request MUST NOT wait for a health check. It MUST be sent immediately to the last known good origin.
- R1.2 The last known good origin id MUST be persisted (AsyncStorage, key `pyqdeck:backend_origin`, value `ec2` or `render`) whenever selection succeeds or a failover switches origin, and read once at boot. With no stored value, the default stays `render` (current shipped default).
- R1.3 Reading the stored origin MUST NOT block first render. If it has not been read when the first request fires, the default origin is used.
- R1.4 The health check MUST still run in the background at boot and on foreground return after 5 minutes (existing `recheckIfStale`), so a session that fell back to Render climbs back to EC2.
- R1.5 Failover behaviour stays as is: 5xx or transport error on a first attempt triggers `failover()` and one retry on a different origin; 4xx (including 429) never triggers failover; `isRetry` still caps retries at one.
- R1.6 Concurrent callers MUST still share one in-flight health check.
- R1.7 The debug banner and `setPinned` dev override keep working.

### 2.3 Acceptance criteria
- With the network available, the first `fetch` to `/api/public/...` starts before any `/api/ping` completes (verify with request logs).
- With the stored origin unreachable, the request fails over once and succeeds on the other origin.
- With both unreachable, the error is the same `offline`/`unreachable` `ApiError` as today.
- Airplane mode still classifies as `offline`.

## 3. R2: Startup side effects gated on onboarding

### 3.1 Current behaviour (verified)
The `useEffect` in `AppContent` (`App.tsx`) runs unconditionally on mount: `mobileAds().initialize()`, `registerForPushNotificationsAsync()`, `subscribeToNotificationResponses()`, `Backend.ready()`, the foreground listener, and `checkForStoreUpdate()` then `maybeRequestReview()`. `onboarded === null` only stops rendering, not these effects. A first-time user can see the OS notification permission prompt, a store-update dialog, and a review prompt over onboarding.

### 3.2 Requirements
- R2.1 `registerForPushNotificationsAsync()`, `checkForStoreUpdate()` and `maybeRequestReview()` MUST NOT run until `onboarded === true` (either already seen on launch, or completed in this session).
- R2.2 The existing sequencing MUST be preserved: the review prompt runs only after the update check settles.
- R2.3 `Backend.ready()` and the foreground recheck listener stay unconditional (they show nothing to the user).
- R2.4 `mobileAds().initialize()` stays unconditional. It shows nothing and starting it early protects ad revenue. The interstitial policy in `src/utils/ads.ts` is unchanged.
- R2.5 `subscribeToNotificationResponses()` stays unconditional so a notification tap is never missed.
- R2.6 Returning users (onboarding already seen) MUST see no change in behaviour or added delay.
- R2.7 When onboarding finishes in-session, the gated effects run once, not on every later render.

### 3.3 Acceptance criteria
- Fresh install: the notification permission prompt does not appear until onboarding is completed.
- Second launch: push registration, update check and review check run as they do today.
- `handleColdStartNotification` behaviour is unchanged.

## 4. R3: Prefetch on subject open (PYQ path)

### 4.1 Current behaviour (verified)
`QuestionListScreen` calls `useSubjectMeta`, waits for meta, then sets `yearResolved`, and only then fetches questions for the default year (`meta.years[0]`). That is two serial requests after navigation.

### 4.2 Requirements
- R3.1 When a student presses a subject (subject rows in `SubjectListScreen`, `AllSubjectsScreen`, search subject results, Home recents), the app MUST start `queryClient.prefetchQuery(subjectMetaQuery(id))` immediately, before or alongside `navigate`.
- R3.2 When the prefetched meta resolves, the app MUST prefetch `questionsQuery(id, { year: meta.years[0]?.year })` with the same params `QuestionListScreen` will use, so the key matches and the screen finds cached data.
- R3.3 Prefetch MUST reuse the existing `subjectMetaQuery` / `questionsQuery` options and `qk` keys. No new keys.
- R3.4 Prefetch failures MUST be silent and never block navigation.
- R3.5 `QuestionListScreen` MUST NOT gain any extra request. If the prefetch is in flight, React Query de-duplicates.
- R3.6 One shared helper (for example `prefetchSubject(subjectId)` in `src/api/prefetch.ts`) MUST be used by every press site, so behaviour is defined once.
- R3.7 Prefetch of the default year is skipped when the route is opened with an explicit `initialYear` or `initialChapter` (in which case `yearResolved` starts true), and instead prefetches exactly those params.

### 4.3 Acceptance criteria
- Pressing a subject issues the meta request before `QuestionList` mounts; the questions request follows meta with no idle gap.
- On a warm cache no additional request is made.
- Fast repeated taps do not duplicate requests.

## 5. R4: Everything through React Query

### 5.1 Current behaviour (verified)
These bypass React Query and hold results in `useState`:

| Code | Calls | Issue |
|---|---|---|
| `SearchScreen.runSearch` | `searchSubjects`, `searchAllQuestions`, `searchTopicNotes`, then `getAiOverview` | No cache, no de-duplication, no cancellation; repeat query refetches |
| `SearchScreen` mount effect | `listAllSubjects()` for 6 suggestion chips | Extra request on every mount |
| `SearchScreen` | `getAiOverviewStatus()` once via ref | Manual once-per-session cache |
| `AllSubjectsScreen` | `listAllSubjects({q, page})` | Manual paging state |
| `TopicNotesScreen` | `getTopicNotes()` | Manual state; intentionally not persisted |
| Search 429 handling | hard-coded `retry = 15` | Ignores `ApiError.retryAfterSec` |

`request()` also ignores an `AbortSignal`, so React Query cannot cancel anything.

### 5.2 Requirements

**Cancellation**
- R4.1 `request()` and the fetchers in `src/api/index.ts` MUST accept an optional `AbortSignal` and pass it to `fetch`, combined with the existing 20 s timeout controller. An abort MUST NOT trigger failover and MUST NOT be reported as a network error.
- R4.2 Query functions MUST forward React Query's `signal`.

**Search**
- R4.3 Define in `src/api/queries.ts` (keys in `queryKeys.ts`): `searchSubjectsQuery(q)`, `searchQuestionsQuery(q)`, `searchNotesQuery(q)`, `aiOverviewStatusQuery()`, `aiOverviewQuery(q)`, `allSubjectsQuery({q, page})` (infinite for paging), `topicNotesQuery(subjectId, topicId)`.
- R4.4 Keys MUST include the normalised query (`normalizeQuery` output, lower-cased for the key), so the same search returns from cache.
- R4.5 Search queries MUST NOT be persisted (no `persistMeta`), use `staleTime` of 5 minutes and a bounded `gcTime` (10 minutes), so memory stays small and results stay fresh enough for a short-lived interaction.
- R4.6 The search screen MUST keep the submit-triggered behaviour and the token-bucket guard (`searchGuard.ts`). Query is enabled only for the submitted, validated string. Debounced live search is not part of this SRS.
- R4.7 The three searches MUST run in parallel (as today) and a failure in one MUST NOT hide results from the others (equivalent to today's `allSettled`).
- R4.8 The AI overview MUST remain non-blocking: results render first, the overview fills in when ready, and a failure shows no card (no error UI). Its status query is cached for the session (`staleTime: Infinity`, not persisted).
- R4.9 A new submitted query MUST cancel the previous in-flight search requests. A slower earlier result MUST NOT overwrite a newer one.
- R4.10 On HTTP 429, the cooldown MUST use `ApiError.retryAfterSec` when present (clamped by `applyServerRetryAfter`), falling back to 15 s only if absent. The "Too many searches" message and haptic stay.
- R4.11 The existing offline fallback (`searchLocalCache`) MUST keep working when all three searches fail or return nothing.
- R4.12 Suggestion chips MUST come from an existing cached source (`semestersQuery` / `subjectsQuery`, or `allSubjectsQuery` first page) instead of an extra request on each mount. When only `allSubjectsQuery` is used, it MUST share the cache entry with the All Subjects screen.
- R4.13 Recent searches (AsyncStorage) are unchanged.

**All Subjects**
- R4.14 `AllSubjectsScreen` MUST use `useInfiniteQuery` for paging and `q` in the key, replacing the manual `page`, `subjects`, `loading`, `loadingMore` state. Pull-to-refresh refetches through the query. Its existing search box behaviour is unchanged.

**Topic notes**
- R4.15 `TopicNotesScreen` MUST use `topicNotesQuery`. To preserve the product decision that notes are never stale, use `staleTime: 0` (refetch on mount) and no persistence. The previous-data-while-refetching behaviour of React Query is acceptable and improves the experience.

**General**
- R4.16 After this change, `grep` for direct calls to `searchSubjects`, `searchAllQuestions`, `searchTopicNotes`, `listAllSubjects`, `getTopicNotes`, `getAiOverview`, `getAiOverviewStatus` outside `src/api/` MUST return no screen call sites. Screens use hooks or `queryClient` only.
- R4.17 Mutations (vote, report, push-token registration) stay as plain authed POSTs; they are not queries.

### 5.3 Acceptance criteria
- Searching the same term twice within 5 minutes sends no second request.
- Submitting a new search while one is in flight aborts the old one and shows only the new results.
- A 429 with `Retry-After: 30` produces a 30 s cooldown (capped at 60 s by the existing helper).
- Opening Search sends no `/subjects` request when suggestions can be built from cached data.
- All Subjects paging, search and pull-to-refresh behave as before.
- No screen imports the fetchers listed in R4.16.

## 6. R5: Continue where you left off

### 6.1 Current behaviour (verified)
`src/utils/recentStudy.ts` stores up to 4 recent subjects (with an optional year) and 2 recent notes, shown on Home. It does not store which question was open or the paper position. `QuestionDetailScreen` records nothing about progress within a paper.

### 6.2 Requirements
- R5.1 Add `src/utils/lastPosition.ts` storing one record under `pyqdeck:last_position` (the `pyqdeck:` prefix, like `recentStudy.ts`, so "Clear cache" does not wipe it):
  `{ subjectId, subjectName, semesterId, subjectCode?, year, questionId, qNumber?, updatedAt }`.
- R5.2 The record MUST be written when a question is opened in `QuestionDetailScreen`, and again when the student moves to another question in the same paper (Prev/Next, which uses `setParams`). Writes MUST be fire-and-forget and MUST NOT delay rendering.
- R5.3 Home MUST show a "Continue" card at the top of the recent-items area when a record exists, with subject name, year, question number, and time since last visit. Tapping opens `QuestionDetail` with the stored params.
- R5.4 The card MUST refresh on focus (the existing `useFocusEffect` in `HomeScreen`), so it updates after returning from a paper.
- R5.5 The card MUST be hidden when there is no record, and MUST tolerate a malformed stored value (treat as absent).
- R5.6 If the stored question no longer exists (deleted server-side), the question screen's existing error state applies, and the card MUST offer a way to clear itself (dismiss control, which calls `clearLastPosition()`).
- R5.7 Opening from the card MUST use the R3 prefetch helper for the subject, and a `questionQuery` prefetch for the stored question, so the screen renders quickly.
- R5.8 The record is device-local and anonymous. It MUST NOT be sent to the server (consistent with `syllabusProgress.ts`).
- R5.9 Add "Clear recent activity" behaviour in Settings only if Settings already has a clear-recents control; otherwise reuse the same function used there (`clearRecentStudies`) and clear the last position with it. No new Settings UI is required.

### 6.3 Acceptance criteria
- Open Subject A, year 2024, question 3, navigate to Next (question 4), leave the app, relaunch: Home shows "Continue: A, 2024, Q4".
- Tapping the card opens Q4 directly with back navigation returning to Home.
- Opening a different paper replaces the record.
- Deleting the record (dismiss) removes the card and survives a relaunch.

## 7. Non-functional requirements
- N1 No new dependencies for R1 to R5 beyond what is already installed (`@tanstack/react-query`, AsyncStorage). If a new Expo package looks necessary, it MUST be justified against the v57 docs first.
- N2 No native code, no config plugin, no `eas build`. Releases stay on the GitHub Actions workflow.
- N3 `npx tsc --noEmit` MUST pass (it passes today).
- N4 No new `any` in code added by this work.
- N5 No change to the persisted cache shape, so `CACHE_BUSTER` is not bumped.
- N6 Ad behaviour, ad frequency and interstitial counters are unchanged.

## 8. Test plan
No test framework exists in the repo, so verification is manual plus `tsc`:
1. `tsc --noEmit` clean.
2. First-launch flow on a fresh install: no notification/update/review prompt before onboarding completes.
3. Request log check (dev build with the debug banner): first data request precedes ping completion; failover works by pinning/blocking one origin.
4. PYQ path: Home to Subject to Question List with request log; count requests before and after.
5. Search: repeat, cancel, 429, offline, empty results.
6. All Subjects: paging, search, refresh, offline.
7. Topic notes: opens fresh, back and re-open, offline message.
8. Resume: the four scenarios in 6.3.

## 9. Delivery plan

| Step | Item | Notes |
|---|---|---|
| 1 | R2 startup gating | Smallest, independent |
| 2 | R1 optimistic origin | Add persisted origin read and background check |
| 3 | R3 prefetch helper | Depends on nothing else |
| 4 | R4 signal plumbing, then search, All Subjects, topic notes | Largest; one PR or one commit per screen |
| 5 | R5 last position + Home card | Uses R3 helper |

Each step is independently shippable and revertible.

### Follow-ups not in this SRS
- **Backend (audit H2):** add `subjectCount` to `/semesters` so Home stops fetching every semester's subjects. Alternatively the backend accepts `year=latest` on the questions endpoint, which would remove the meta-before-questions dependency entirely (then R3.2 simplifies).
- Bundle trimming, CI typecheck, accessibility, dark mode, bookmarks.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Stored origin points at a dead server, first request fails once | Single automatic failover retry (R1.5); health check corrects the stored value |
| Aborting requests surfaces as an error | R4.1: abort is not classified as a network failure |
| Search caching shows slightly old results for 5 minutes | Acceptable for search; pull or new query text bypasses it |
| Prefetch fires requests the student never uses | Bounded to one subject at a time; React Query de-duplicates |
| Last-position write races with fast Prev/Next taps | Last write wins by `updatedAt`; writes are idempotent |
