# Client-Side Search Abuse Handling — Expo Plan

**Branch:** `client-side-abuse-handling`  
**Scope:** `src/screens/SearchScreen.tsx`, `src/api/index.ts`, `src/utils/searchGuard.ts` (new)  
**Problem:** `SearchScreen.tsx:75` fires `searchSubjects` + `searchAllQuestions` (semantic = embedding+Qdrant, expensive) with **zero client checks**. Spam = server `apiLimiter` 6000/15m is generous + disabled in dev (`rateLimiter.js:25`). Need cheap client gates before network.

## Goals
- Block accidental + intentional spam without breaking legit UX / offline fallback
- No new deps, no server change in this branch (server already has token-bucket in `server/middleware/rateLimiter.js`)
- KeepOffline fallback `cacheService.ts:250` working

## Threats
1. Rapid tap / script loop calling `handleSearch` every 100ms
2. Empty / 1-char / 500-char queries wasting embedding calls
3. Same query resent while previous request inflight
4. Special-char / whitespace-only queries
5. Ignoring 429 Retry-After from server

## What We Will Do

### 1) Input Validation — `src/utils/searchGuard.ts`
- `normalizeQuery(q): string | null` — trim, collapse `\s+` → single space, `encodeURIComponent` later
- rules:
  - `trimmed.length < 2` → reject ("Type at least 2 characters")
  - `trimmed.length > 100` → truncate or reject ("Max 100 chars")
  - `!/[a-zA-Z0-9]/` (no alphanumeric) → reject
  - normalize case for dedup: `lower = trimmed.toLowerCase()`
- returns `{ ok, query, error }` — UI shows `error` inline, no network call

### 2) Request Deduplication & Inflight Guard — `SearchScreen.tsx`
- `if (loading) return` at top of `handleSearch` / `handleSuggestionPress`
- `lastQueryRef = useRef('')` — if `normalized === lastQueryRef.current` and results already shown, skip (or allow manual refresh via pull)
- keep existing `onChangeText` clearing but do NOT fire network there

### 3) Client Token-Bucket Throttle — `src/utils/searchGuard.ts`
- tiny in-memory bucket: `capacity: 5`, `refill: 1 token / 2 sec` ( = 30/min max, bursty 5 )
- `canSearch(): { allowed, retryAfterMs }`
- `takeToken()` on each `handleSearch`
- if blocked → set `cooldownSec` state, show banner "Too fast — try again in Xs", disable input button
- countdown via `setInterval` 1s, re-enable when 0
- stored in-memory only (no AsyncStorage to avoid persistence abuse); resets on app restart which is fine

### 4) Cooldown & UI Guards — `SearchScreen.tsx`
- new state: `cooldownSec: number`, `validationError: string | null`
- `searchInput` `editable={!loading && cooldownSec===0}`
- search button / `onSubmitEditing` checks `cooldownSec`
- show inline text under search bar:
  - validation error in `COLORS.error`
  - cooldown in `COLORS.textMuted` → "Slow down — Xs left"
  - 429 error maps to cooldown as well
- keep `ActivityIndicator` already at `SearchScreen.tsx:195`

### 5) 429 / Retry-After Handling — `src/api/index.ts`
- `fetchApi` already throws `ApiError` with `status`
- in `handleSearch` catch: if `e.status===429`, parse `Retry-After` header if available (needs `fetch` to expose headers) else fallback 15s, set `cooldownSec = retryAfter`
- show toast/banner instead of falling directly to offline cache for 429 (offline fallback hides the abuse signal)

### 6) Debounce (light)
- Not needed for submit-on-enter, but add `300ms` debounce wrapper for `handleSuggestionPress` rapid taps: `if (Date.now() - lastTap < 300) return`
- alternative: reuse same token bucket covers it

## File Changes
| File | Action |
|------|--------|
| `src/utils/searchGuard.ts` | **new** — `normalizeQuery`, `canSearch`, `takeToken`, bucket + validation |
| `src/screens/SearchScreen.tsx` | import guard, add `cooldownSec`/`validationError` state, gate `handleSearch`/`handleSuggestionPress`, render banners, respect 429 |
| `src/api/index.ts` | expose `res.headers.get('Retry-After')` in `ApiError` (optional) |
| `docs/client-abuse-handling-plan.md` | this plan |

## How We Verify
- manual: rapid tap search 10x → first 5 go through, next blocked with countdown
- query `""`, `"a"`, `"!!! "`, 150-char paste → validation message, no network in React Native debugger Network tab
- spam while `loading` → no duplicate `fetch`
- server 429 → UI shows cooldown not empty results
- existing offline flow unchanged: valid query with offline + empty online → still hits `Cache.searchLocalCache`

## What We Will NOT Do (this branch)
- server `rateLimiter.js` changes (separate PR)
- CAPTCHA / device attestation
- persistent AsyncStorage counters (easy to clear, adds complexity)
- changes to `pyqdeck-frontend` web search (same pattern but separate)

## Rollout
1. Land this branch, test on Expo Go + `npx expo start`
2. `eslint` passes, no new deps
3. Merge to `master` after manual abuse test
