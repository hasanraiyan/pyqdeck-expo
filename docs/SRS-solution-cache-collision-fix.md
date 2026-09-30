# SRS: Fix Cross-Subject Solution Cache Collision

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Component | Client cache layer (`src/db/cacheService.ts`, `src/api/index.ts`) |
| Status | Draft |
| Priority | High (user sees incorrect academic content) |

## 1. Introduction

### 1.1 Purpose
Specify the changes needed so that a question's solution shown in the app always belongs to the subject (and question) the user opened.

### 1.2 Problem statement
A user viewing a Software Engineering question (`questionId "Q6"`, `qNumber "Q1f"`, year 2025) sees the Web Technology Q6 solution (Apache Tomcat / Java).

### 1.3 Root cause
Solutions are cached in AsyncStorage under `pyq_solution_${questionId}`, with no subject id. `questionId` values (`Q1`..`Qn`) repeat across subjects, so the first subject's Q6 solution is returned for every later Q6.

- Read path: `src/api/index.ts:313-314` calls `Cache.getCachedSolution(questionId)` and returns on any hit, never reaching the network.
- Write path: `src/db/cacheService.ts:207-210` accepts `subjectId` but ignores it, keying on `solution.questionId`.
- The solution cache has no TTL or validation, so the wrong entry persists indefinitely.
- The same flaw exists in `pyq_question_${questionId}` (`cacheService.ts:177, 187`), which also feeds `searchOfflineQuestions` (line 224).

### 1.4 Scope
In scope: solution cache, per-question cache, migration of existing bad entries, tests.
Out of scope: server API changes, UI changes. The solution TTL (section 5) is a separate follow-up commit.

### 1.5 Definitions
- **Subject id**: id in `/subjects/{subjectId}/...` API routes.
- **Poisoned entry**: a legacy `pyq_solution_*` or `pyq_question_*` key written without a subject id.

## 2. Overall description

- Cache backend: `@react-native-async-storage/async-storage`.
- Other caches (`pyq_q_*`, `pyq_meta_*`, `pyq_subjects_*`) already include the subject/semester id and are unaffected.
- Callers of `getSolution`: `QuestionDetailScreen.tsx:132`, `QuestionItem.tsx:90`. Both already have `subjectId` available.

## 3. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Solution cache keys MUST include the subject id: `pyq2_solution_${subjectId}_${questionId}`. |
| FR-2 | `getCachedSolution` MUST take `(subjectId, questionId)`; `saveCachedSolution` MUST use its `subjectId` argument to build the key. |
| FR-3 | `getSolution` MUST pass `subjectId` to both cache read and write. |
| FR-4 | Per-question cache keys MUST include the subject id: `pyq2_question_${subjectId}_${questionId}`; `getCachedQuestion` takes `(subjectId, questionId)`. |
| FR-5 | `saveCachedQuestions` MUST write per-question keys using its `subjectId` argument. |
| FR-6 | `searchOfflineQuestions` MUST scan the new `pyq2_question_` prefix only. |
| FR-7 | On app start, a one-time migration MUST delete all legacy `pyq_solution_*` and `pyq_question_*` keys, guarded by a flag key (e.g. `pyq_cache_migrated_v2`) so it runs once. |
| FR-8 | Before caching or returning a cached solution, the client SHOULD verify `solution.questionId === questionId`; on mismatch, discard the entry and fetch live. |
| FR-9 | Year is NOT part of any key. `questionId` is unique per subject (resolved decision D1). |
| FR-10 | Offline fallback behaviour is unchanged: on network failure return the subject-scoped cached solution if present, else throw. |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| FR-11 | The local vote mirror in `src/utils/votes.ts` (`my_solution_votes`) MUST be keyed `${subjectId}:${questionId}`. `getMyVote` and `setMyVote` take `(subjectId, questionId, ...)`; callers (`QuestionItem.tsx`, `QuestionDetailScreen.tsx`) pass the `subjectId` already in scope. |
| FR-12 | The migration (FR-7) MUST also clear the legacy `my_solution_votes` key. Old entries carry no subject and cannot be re-keyed safely; highlight state repopulates from the server's per-account vote state on next fetch. |
| NFR-1 | No extra network requests in the normal (cache-hit) path. |
| NFR-2 | Migration MUST be non-blocking to first render (run async after startup, errors swallowed and logged). |
| NFR-3 | Follow existing code style and try/catch pattern in `cacheService.ts`. |
| NFR-4 | Implementation uses only existing dependencies (AsyncStorage); no native code (per AGENTS.md). |

## 5. Resolved decisions and follow-ups

**D1. Year is not needed in the key.** The server enforces `questionSchema.index({ questionId: 1, subject: 1 }, { unique: true })` (`server/server/models/Question.js:43`, "Local ID per subject"). Live data for `sem6_software_engineering`: 2025 Q1f = Q6, 2024 Q1f = Q54, 2023 Q1f = Q131; ids increment and never repeat within a subject. `subjectId + questionId` is a complete key; the reported bug is a missing subject, not a missing year.

**D2. Votes need the same fix, at smaller scope.** `votes.ts:8,23,29` store `Record<questionId, 1|-1>`, so voting on SE Q6 highlights Web Technology Q6 too. The server side is correct: votes are keyed by the solution ObjectId (`models/SolutionVote.js:14,28`) through a subject-scoped route (`publicDataRoutes.js:113-120`). Only the local highlight mirror is affected (FR-11, FR-12).

**D3. Solution TTL: agreed, separate follow-up commit.** Today `getSolution` (`src/api/index.ts:313-314`) is cache-first with no freshness check, so a solution is served until `clearAllCache()`. Solutions are mutable (admin fixes after reports, cached `upvotes`/`downvotes` go stale, `isAnswerAvailable` flips). Proposed shape: store `{ solution, cachedAt }`; serve cached if under `CACHE_TTL_MS` (12h, `cacheService.ts:11`), otherwise revalidate in the background and fall back to the stale copy on network failure, matching `getQuestions:295-303`. Not part of this change.

## 6. Design summary

```ts
// cacheService.ts
const solKey = (s: string, q: string) => `pyq2_solution_${s}_${q}`;
export async function getCachedSolution(subjectId: string, questionId: string) { ... }
export async function saveCachedSolution(subjectId: string, solution: Solution) {
  await AsyncStorage.setItem(solKey(subjectId, solution.questionId), JSON.stringify(solution));
}

// api/index.ts getSolution
const cached = await Cache.getCachedSolution(subjectId, questionId);
if (cached && cached.questionId === questionId) return cached;

// migration (run once at startup)
const keys = await AsyncStorage.getAllKeys();
await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('pyq_solution_') || k.startsWith('pyq_question_')));
await AsyncStorage.setItem('pyq_cache_migrated_v2', '1');
```

## 7. Acceptance criteria and test plan

| ID | Scenario | Expected |
|---|---|---|
| AC-1 | Open Web Technology Q6, then Software Engineering Q6 | SE solution is fetched and shown; no Tomcat/Java content |
| AC-2 | Reverse order of AC-1 | Same, each subject shows its own solution |
| AC-3 | Open the same question twice | Second load served from cache, no network call |
| AC-4 | Device with legacy poisoned `pyq_solution_Q6` upgrades | Legacy key removed at startup; correct solution shown |
| AC-5 | Offline after viewing a solution | Cached subject-scoped solution shown |
| AC-6 | Offline search | Returns only subject-correct questions, no duplicates from key collisions |
| AC-7 | Migration runs twice | Second run is a no-op |
| AC-8 | Upvote SE Q6 | Web Technology Q6 is not highlighted; SE Q6 is |
| AC-9 | Upgrade with legacy `my_solution_votes` | Key cleared; highlights repopulate from server state |

Unit tests: vote key builder and get/set round-trip, key builders, `getSolution` cache hit/miss/mismatch, migration idempotence (mock AsyncStorage).

## 8. Risks

- Users lose offline solution cache once after upgrade (acceptable; re-fetched on demand).
- Users lose their local vote highlights once after upgrade until the server state is refetched.

## 9. Files affected

- `src/db/cacheService.ts`
- `src/api/index.ts`
- App startup (e.g. `App.tsx`) for the migration call
- `src/utils/votes.ts` and its callers `src/components/QuestionItem.tsx` (~line 106) and `src/screens/QuestionDetailScreen.tsx`
