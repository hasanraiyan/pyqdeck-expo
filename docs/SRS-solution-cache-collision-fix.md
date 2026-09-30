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
Out of scope: server API changes, vote storage redesign (see 5, open questions), UI changes.

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
| FR-9 | If the year is required to make a question unique within a subject (see Q1 in section 5), the year MUST be added to the key of FR-1 and FR-4. |
| FR-10 | Offline fallback behaviour is unchanged: on network failure return the subject-scoped cached solution if present, else throw. |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | No extra network requests in the normal (cache-hit) path. |
| NFR-2 | Migration MUST be non-blocking to first render (run async after startup, errors swallowed and logged). |
| NFR-3 | Follow existing code style and try/catch pattern in `cacheService.ts`. |
| NFR-4 | Implementation uses only existing dependencies (AsyncStorage); no native code (per AGENTS.md). |

## 5. Open questions

1. **Is `questionId` unique per subject across years?** If `Q6` repeats between 2024 and 2025 papers of the same subject, subject-only keys still collide; then FR-9 applies. Verify against the API (e.g. `browse_content` for the SE subject).
2. **Votes.** `src/utils/votes.ts` stores `my_solution_votes`; confirm its key includes the subject id, or apply the same fix.
3. Should solutions get a TTL (like the 12h question cache) so edited or moderated solutions refresh? Recommended follow-up, not required here.

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

Unit tests: key builders, `getSolution` cache hit/miss/mismatch, migration idempotence (mock AsyncStorage).

## 8. Risks

- Users lose offline solution cache once after upgrade (acceptable; re-fetched on demand).
- If FR-9 is needed and skipped, collisions persist within a subject.

## 9. Files affected

- `src/db/cacheService.ts`
- `src/api/index.ts`
- App startup (e.g. `App.tsx`) for the migration call
- Possibly `src/utils/votes.ts` (open question 2)
