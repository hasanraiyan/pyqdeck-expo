# SRS: Unified Data Cache Layer for All API Data

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Component | Client data fetching and caching (`src/api`, `src/db`, screens) |
| Status | Draft |
| Follows | `SRS-solution-cache-collision-fix.md` (subject-scoped keys, already implemented) |

## 1. Introduction

### 1.1 Purpose
Replace the hand-written, per-endpoint caches with one consistent caching layer for all API data, so key construction, freshness, offline fallback and invalidation are defined in one place. This removes the class of bug that caused the Q6 cross-subject solution collision (a string key built by hand that omitted the subject id).

### 1.2 Current state (verified)
- No caching library. `package.json` has only `@react-native-async-storage/async-storage`; no React Query, MMKV, SWR or SQLite.
- Caches are hand-written per endpoint:

| Data | Code | Storage key | Freshness | Offline behaviour |
|---|---|---|---|---|
| Semesters | `api/index.ts:172-190` | `pyq_semesters` | 12h | stale fallback |
| Subjects | `api/index.ts:195-212` | `pyq_subjects_${semesterId}` | 12h | stale fallback |
| Subject meta | `api/index.ts:218-240` | `pyq_meta_${subjectId}` | 12h | stale fallback |
| Question lists | `api/index.ts:246-305` | `pyq_q_questions_${subjectId}_y[..]_c[..]` | 12h | stale fallback |
| Single question | `cacheService.ts` | `pyq_v2_question_${subjectId}_${qid}` | none | none (getter unused) |
| Solutions | `api/index.ts:311-327` | `pyq_v2_solution_${subjectId}_${qid}` | **none, forever** | cached copy |
| Syllabus (4 endpoints) | `api/index.ts:394-437`, `db/syllabusCache.ts` | `pyq_syl_*` | network-first | stale fallback |
| Topic notes | `getTopicNotes` | not cached (by design) | n/a | none |
| Similar / repeats / semantic search / AI overview | `api/index.ts` | not cached | n/a | none |

- Screens hold results in `useState` plus `useEffect`; there is no shared in-memory cache, no request de-duplication, and no cache invalidation after a vote or report.
- Cache metadata lives in separate `pyq_cm_*` keys, written non-atomically with the value.
- `api/index.ts` comments still call the cache "SQLite"; it is AsyncStorage.

### 1.3 Problems this SRS addresses
1. Three different freshness policies (12h, 24h/network-first, never) chosen ad hoc.
2. Solutions never expire, so edits, moderation fixes and vote counts go stale (deferred follow-up D3 of the previous SRS).
3. Keys are built by hand in several files; a missing segment silently causes collisions.
4. No in-memory sharing: the same subject or question list is refetched and re-parsed from AsyncStorage on every screen mount.
5. Vote/report writes do not update cached solution counts.
6. Value and freshness metadata can be out of sync (two writes).

### 1.4 Scope
In scope: all read endpoints that return catalogue, question, solution and syllabus data; offline persistence; invalidation on vote/report; cache clearing; migration of old keys.
Out of scope: server API changes; auth token storage (`src/auth`); user-preference storage (`utils/settings.ts`, `onboarding.ts`, `recentStudy.ts`, `ads.ts`, `appReview.ts`); the local vote highlight mirror (kept as is, subject-scoped).

## 2. Proposed approach

Adopt **TanStack Query v5** (`@tanstack/react-query`) with the official AsyncStorage persister (`@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`), pure JavaScript, so no native code or config plugin is needed (consistent with AGENTS.md; no `eas build`).

Alternative considered: keep the hand-written approach and add a single generic `cachedFetch(key, fetcher, {ttl, mode})` helper. Lower dependency cost, but re-implements de-duplication, retries, invalidation and persistence. Recommended only if a new dependency is unacceptable (see section 7, Q1).

## 3. Functional requirements

### 3.1 Query keys
| ID | Requirement |
|---|---|
| FR-1 | All query keys MUST be built by one module, `src/api/queryKeys.ts`; screens and the API layer MUST NOT hand-build keys. |
| FR-2 | Keys MUST be arrays, hierarchical, and include every parameter that changes the response, including the subject id. |
| FR-3 | Key set: `['semesters']`, `['subjects', semesterId]`, `['subject', subjectId]`, `['questions', subjectId, {year, chapter, limit}]`, `['question', subjectId, questionId]`, `['solution', subjectId, questionId]`, `['similar', subjectId, questionId, limit]`, `['repeats', subjectId, questionId, limit]`, `['syllabus', 'branches']`, `['syllabus', 'semesters', branch]`, `['syllabus', 'semester', branch, semester]`, `['syllabus', 'subject', subjectId]`. |
| FR-4 | A unit test MUST assert that keys for the same `questionId` in two subjects are different. |

### 3.2 Freshness (`staleTime`) and retention (`gcTime`)
| ID | Data | staleTime | Persist / gcTime | Refetch behaviour |
|---|---|---|---|---|
| FR-5 | Semesters, subjects, subject meta | 12h | 7 days | stale-while-revalidate |
| FR-6 | Question lists, single question | 12h | 7 days | stale-while-revalidate |
| FR-7 | **Solutions** | 12h | 7 days | serve cached, revalidate in background when stale, keep stale copy on network failure |
| FR-8 | Syllabus (4 endpoints) | 0 (network-first, as today) | 30 days | always try network on mount; persisted copy is the offline fallback |
| FR-9 | Topic notes | 0 | not persisted | as today (never stale-served) |
| FR-10 | Similar, repeats, semantic search, AI overview | 5 min | not persisted | in-memory only |

### 3.3 Offline and persistence
| ID | Requirement |
|---|---|
| FR-11 | Persist selected query families (FR-5 to FR-8) to AsyncStorage through the persister, under one key (e.g. `pyq_rq_cache`), with a `buster` string so a schema change discards it. |
| FR-12 | When the network fails and a persisted value exists, the UI MUST show it (equivalent to today's stale fallback) and MAY show a non-blocking "offline" indicator. |
| FR-13 | Persistence MUST be throttled (e.g. 1s) to avoid a write on every state change. |
| FR-14 | `searchOfflineQuestions` MUST be reimplemented over persisted `['questions', ...]` and `['question', ...]` data, not by scanning storage keys. |

### 3.4 Invalidation and mutations
| ID | Requirement |
|---|---|
| FR-15 | Vote and report actions MUST be `useMutation`s. On success they MUST update the cached `['solution', subjectId, questionId]` (vote counts) via `setQueryData`; on error, roll back the optimistic update. |
| FR-16 | Pull-to-refresh MUST call `refetch` / `invalidateQueries` for the visible screen's keys (replaces the current no-op `forceRefresh` parameters). |
| FR-17 | Sign-out MUST clear user-specific data if any is cached (none today; requirement guards future additions). |

### 3.5 API layer and screens
| ID | Requirement |
|---|---|
| FR-18 | `src/api/index.ts` MUST reduce to plain fetchers (no cache reads/writes inside). Fetchers keep the existing endpoints and the backend fallback behaviour in `api/backend.ts`. |
| FR-19 | Add hooks `useSemesters`, `useSubjects`, `useSubjectMeta`, `useQuestions`, `useQuestion`, `useSolution`, `useSyllabus*`, and refactor the 12 screens/components that import from `../api` to use them, removing hand-rolled loading/error `useState` where the hook replaces it. |
| FR-20 | `QueryClientProvider` and `PersistQueryClientProvider` MUST wrap the app in `App.tsx` above the navigator. |
| FR-21 | "Clear cache" in Settings MUST call `queryClient.clear()` and remove the persisted key, plus the legacy sweep below. |

### 3.6 Migration
| ID | Requirement |
|---|---|
| FR-22 | On first launch after upgrade, a one-time flagged migration MUST remove legacy `pyq_*` keys (`pyq_semesters`, `pyq_subjects_*`, `pyq_meta_*`, `pyq_q_*`, `pyq_cm_*`, `pyq_v2_solution_*`, `pyq_v2_question_*`, `pyq_syl_*`). Data re-fetches on demand; no data is user-authored. |
| FR-23 | User-authored/preference keys (`my_solution_votes_v2`, `recentStudy`, settings, onboarding, review, ads) MUST NOT be touched. |

## 4. Non-functional requirements
| ID | Requirement |
|---|---|
| NFR-1 | No native code, no config plugin, no `eas build`; JS-only dependency (AGENTS.md). |
| NFR-2 | Cold-start to first cached screen MUST not be slower than today; persister restore is async and the UI renders a skeleton until restored. |
| NFR-3 | Persisted cache size cap: exclude non-persisted families; target under 5 MB; drop oldest entries (`maxAge`) beyond retention. |
| NFR-4 | Network requests on repeat visits within `staleTime`: zero. |
| NFR-5 | Failures in persistence MUST be swallowed and logged, never crash the app. |
| NFR-6 | Verify the Expo SDK 57 docs for any Expo-specific integration (AsyncStorage version compatibility) before implementation, per AGENTS.md. |

## 5. Design sketch

```js
// src/api/queryKeys.ts  (single source of truth)
export const qk = {
  semesters: () => ['semesters'],
  subjects: (semesterId) => ['subjects', semesterId],
  questions: (subjectId, p = {}) => ['questions', subjectId, p],
  question: (subjectId, questionId) => ['question', subjectId, questionId],
  solution: (subjectId, questionId) => ['solution', subjectId, questionId],
};

// hooks
export const useSolution = (subjectId, questionId) =>
  useQuery({
    queryKey: qk.solution(subjectId, questionId),
    queryFn: () => fetchSolution(subjectId, questionId),
    staleTime: 12 * 60 * 60 * 1000,
  });
```

Rollout order (each a separate, shippable commit): (1) add dependency, provider, persister, keys module; (2) solutions (fixes D3 TTL); (3) questions and single question; (4) semesters/subjects/meta; (5) syllabus; (6) vote/report mutations with cache updates; (7) remove old cache code and run the FR-22 migration.

## 6. Acceptance criteria
| ID | Scenario | Expected |
|---|---|---|
| AC-1 | Open SE Q6 then Web Tech Q6 | Each shows its own solution (distinct keys) |
| AC-2 | Open a solution twice within 12h | Second open makes no network request |
| AC-3 | Open a solution after 12h | Cached copy shown immediately, refreshed in background |
| AC-4 | Airplane mode after browsing a subject | Semesters, subjects, question lists and viewed solutions still render |
| AC-5 | Upvote a solution | Count updates in the open screen and in the cached entry; rolls back on failure |
| AC-6 | Pull-to-refresh on question list | Data refetched from network |
| AC-7 | Settings, Clear cache | In-memory and persisted cache emptied; next open refetches |
| AC-8 | Upgrade from current release | Legacy keys removed once; app works with empty cache; preferences and vote highlights intact |
| AC-9 | Syllabus edited by admin | Visible on next open while online (network-first preserved) |
| AC-10 | Two screens request the same subject at once | One network request (de-duplicated) |

Tests: `queryKeys` uniqueness (FR-4), migration idempotence, mutation rollback, persister `buster` invalidation.

## 7. Open questions
1. **Dependency:** accept `@tanstack/react-query` + persister, or prefer the in-house `cachedFetch` helper (section 2)?
2. **Syllabus:** keep network-first (FR-8), or move to a 24h stale time now that persistence exists?
3. **Offline indicator:** show one, or stay silent like today?
4. **Retention:** is 7 days right for question and solution data, given exam-season offline use?
5. Does the backend expose `ETag` / `Last-Modified` on these GETs? If so, conditional refetch can cut bandwidth on revalidation (out of scope unless available).

## 8. Risks
- Broad refactor across 12 files; mitigate with the staged rollout above and one commit per data family.
- Persisted cache format is tied to the library version; the `buster` field handles this.
- One-time cache loss on upgrade (acceptable; all data is refetchable).
- Adds ~30 KB of JS dependency.

## 9. Files affected
`package.json`, `App.tsx`, `src/api/index.ts`, new `src/api/queryKeys.ts`, new `src/api/hooks.ts`, `src/db/cacheService.ts` and `src/db/syllabusCache.ts` (removed at the end), `src/screens/*` and `src/components/QuestionItem.tsx` (the 12 importers of `../api`), `src/screens/SettingsScreen.tsx` (clear cache).

## 10. Implementation notes (as built)

- **Retention:** one 30-day `maxAge`/`gcTime` for everything persisted (the persister has a single window), not 7 days for catalog data. Freshness is still governed by `staleTime` (12h catalog/questions/solutions, 0 for syllabus).
- **Votes/reports (FR-15):** the existing race-safe vote state machine (refs, `actionId`, coalescing) was kept rather than rewritten as `useMutation`; on a successful vote it now calls `setQueryData` to update the cached solution's counts. Rollback remains local state; the cache is only touched on success.
- **Size guard:** Android AsyncStorage reads rows through a ~2 MB window, so the persister prunes the least recently updated queries to stay under ~1.8 MB.
- **Persisted key:** `pyq_rq_cache` (swept by "Clear cache").
- **Migration (FR-22):** `migrateToQueryCache()` in `src/db/cacheService.ts`, flag `pyq_cache_migrated_rq`.
- **Offline search (FR-14):** `src/api/offlineSearch.ts` searches the in-memory/restored `['questions']` and `['question']` queries.
- **Not migrated to hooks:** `AllSubjectsScreen` (paginated, uncached), `SearchScreen` online search, topic notes and AI overview (deliberately uncached); the vote/report calls stay imperative.
- **Behaviour fix:** the old question-list cache stored results under a year/chapter-only key even when `search`/`offset` were set; keys now include every param.
