# SRS: AI Overview Follow-up Questions

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Component | Backend `server/server/services/aiOverviewService.js`, `routes/publicDataRoutes.js`; app `AiOverviewCard.tsx`, `SearchScreen.tsx`, `src/types`, `src/api` |
| Status | Draft, awaiting approval. Feasibility verdict in section 3 |
| Related | `SRS-unified-cache-layer.md`, `ai-citation-back-navigation.md` |
| Source | Google Agent Search "Answer" docs (`generative-ai-app-builder/docs/answer`) and the current backend |

## 1. Introduction

### 1.1 Purpose
Under the AI overview on the Search screen, show 2 to 4 tappable follow-up questions (as in the reference screenshot: "What are common AI applications?"). Tapping one runs a new search for that question. This keeps students searching, which means more screen views and more ad impressions.

### 1.2 Hard constraint: no breakage for installed apps
Older Android builds (and the web frontend, `pyqdeck-frontend/components/ai-overview.tsx`) already call `POST /search/ai-overview`. They must keep working unchanged, with no forced update. The current shipped build is 1.0.5 (versionCode 58).

### 1.3 Out of scope
- A chat UI, multi-turn conversation state (the Answer API `session` parameter) and streaming (`streamAnswer`). These are specified in `SRS-ai-chat-streaming.md`. In this document a tap starts a fresh search.
- Changing ranking, the search endpoints, or the ad policy.

## 2. Current state (verified in code)

| Item | Fact |
|---|---|
| Backend call | `getAiOverview()` posts to Discovery Engine **`default_search:search`** (v1alpha) with `contentSearchSpec.summarySpec`. It does **not** use the Answer API. |
| Response shape | `{ enabled, query, text, references[], citations[], totalResults, cached }`. |
| Route | `POST /search/ai-overview`, behind `attachUser` and `aiOverviewLimiter` (40/hour per account or IP). Kill switch: `isAiOverviewLive()` and `AI_OVERVIEW_ENABLED`. |
| Caching | Server: 6 h LRU keyed by `query:count`. App: React Query `qk.aiOverview(q)`, persisted offline. |
| Client type | `AiOverview` in `src/types/index.ts`. `AiOverviewCard` renders text, a Sources pill, and copy/share actions. |
| Search API follow-ups | `summarySpec` returns no related or suggested questions, so the current call cannot produce follow-ups. |

## 3. Feasibility

### 3.1 What Google offers
The **Answer** method (`servingConfigs.answer`, also `streamAnswer`; documented in v1 and v1beta) accepts `relatedQuestionsSpec` and returns `relatedQuestions`, an array of question strings. Per the docs page, related questions need an Enterprise-edition app with the "Generative Responses" option enabled, and the Answer API cannot run against media or healthcare data stores.

**Confirmed by a live call** (v1 `default_search:answer`, engine `pyqdeck_1787542792054`, query "what is artificial intelligence", HTTP 200, raw response in `docs/samples/answer-api-response.json`):
- `relatedQuestionsSpec: { enable: true }` works on this engine. The response has `answer.relatedQuestions`, an array of 5 strings (e.g. "What are the main types of AI?"). It sits inside `answer`, not at the top level.
- Top-level keys are only `answer` and `answerQueryToken`. `answer` holds `state`, `answerText`, `citations`, `references`, `relatedQuestions`, `steps`.
- Answers are long (multi-section markdown), 42 citations over 10 references in that sample.
- Citation shape differs from the Search summary: `startIndex`/`endIndex` are strings, `startIndex` is omitted when 0, and `sources[].referenceId` is a string (0-based). Search summary used numbers and `referenceIndex`.
- References carry the page URL in `chunkInfo.documentMetadata.uri` (plus `title`), so the existing `canonicalUrl`/`parseLink` mapping can be reused.

**Still unknown:** per-call price, latency versus today, and whether follow-ups appear for every query type. The Search REST reference page returned 404, but it is no longer needed for this decision.

### 3.2 Options

| Option | How | Cost per new query | Risk to old clients | Verdict |
|---|---|---|---|---|
| **A. Move overview to Answer API** | One `:answer` call with `relatedQuestionsSpec.enable=true`. Map its answer, citations and references into the existing payload, plus `relatedQuestions`. | About the same as today (still one call; price differs by SKU) | None if the mapping keeps the same field shapes | **Preferred if the spike passes.** Citation mapping (byte offsets, 0-based `referenceIndex`) must be redone and re-verified. |
| **B. Keep Search call, add a second Answer call for questions only** | Extra `:answer` call, discard the answer. | About 2x, and the answer text is generated and thrown away | None | Rejected: pays for an answer we don't use. |
| **C. Keep Search call, generate follow-ups with a small LLM** | One extra Gemini Flash-Lite call given the query, the overview text and reference titles. | Small, but a second billed call and a new dependency (the server has no generation client today) | None | **Fallback** if the engine does not support `relatedQuestionsSpec` or A's answers regress. |

Recommendation: option A is now viable, since `relatedQuestionsSpec` works on the engine. Remaining spike work (section 6, step 1) is quality, latency, price and the citation mapping. If any of those regress badly, do C. Everything else in this document is the same for both.

Note on answer length: the Answer API returned a much longer answer than the current 6-line collapsed card is tuned for. Under A, set a shorter style with `answerGenerationSpec.promptSpec.preamble` (for example "answer in under 120 words") so the overview and its cost do not grow.

### 3.3 Compatibility analysis (why old apps are safe)
- **Additive JSON field.** `relatedQuestions` is a new optional key. The app parses responses with `res.json()` and reads named fields, with no schema validation, so unknown keys are ignored by 1.0.5 and earlier, and by the web frontend.
- **Nothing existing changes.** `text`, `references`, `citations`, `totalResults`, `cached`, `enabled`, and the `enabled:false` disabled response keep their names, types and meaning. Citation offsets stay UTF-8 byte offsets; reference `index` stays 1-based.
- **Same route, same limiter.** No new endpoint means no new rate-limit budget, and the kill switch covers follow-ups automatically. Follow-ups ride along in the same billed call (option A) or the same request (option C), so an old client that fetches an overview costs the same as before under A.
- **Old persisted cache.** Cached `AiOverview` objects in installed apps lack the field, so the new client must treat it as optional and render nothing.
- **New client on old server.** During rollout the server may not have the field yet, so the new client must also treat a missing field as "no follow-ups".
- **Deploy order:** server first, then the app release. No client is ever ahead of the server in a way that breaks.

## 4. Functional requirements

### 4.1 Backend
- F1. `POST /search/ai-overview` MUST add `relatedQuestions: string[]` (0 to 4 items) to its 200 response. It MUST be present, possibly empty, when `enabled` is true, and MAY be omitted when `enabled` is false.
- F2. No existing response field may change name, type or semantics.
- F3. Each question MUST be trimmed, non-empty, at most 120 characters, de-duplicated (case-insensitive), and different from the user's own query. Anything else is dropped, not truncated mid-word.
- F4. A follow-up failure (unsupported feature, empty list, upstream error in the follow-up part) MUST NOT fail the overview. Return `relatedQuestions: []` and log it.
- F5. When the overview `text` is empty (query judged non-summary-seeking), `relatedQuestions` MUST be `[]`.
- F6. The server cache stores the list with the overview under the existing key and TTL. `invalidateAiOverviewCache()` clears both.
- F7. A runtime setting `ai_followups_enabled` (default on, stored in `Setting`, 60 s cache) MUST allow turning follow-ups off without disabling the overview. It is controlled by the existing `manage_ai_overview` MCP tool through its new optional `feature` parameter (`overview` | `followups` | `chat`; omitted means `overview`, as today). It only applies while the overview itself is live (env credentials and `ai_overview_enabled`). When off, the server returns `relatedQuestions: []`, and `GET /search/ai-overview/status` returns `followups: false` (additive key) so the app also hides the chip area. Overview usage logs (`AiOverviewLog`) SHOULD record `followupCount`.
- F7a. **Access:** follow-ups are part of the normal overview and stay **anonymous**: no sign-in needed. Only chat (`SRS-ai-chat-streaming.md`) requires sign-in.
- F8. Option A only: the fallback path. If the Answer call fails outright, fall back to the existing Search-summary code path so the overview (without follow-ups) still works. Keep that path until A has run in production for one release.

### 4.2 App
- F9. `AiOverview` type gains `relatedQuestions?: string[]` (optional).
- F10. `AiOverviewCard` shows follow-up chips below the Sources row and action icons, only in the expanded state or once typing has finished, and only when the list is non-empty. Chips use the pill style from the screenshot (leading `corner-down-right` Feather icon, `COLORS.cardSecondary` background, wrapped in a column list).
- F11. Tapping a chip MUST: fire a selection haptic, put the question in the search box, and submit it through the existing submit path in `SearchScreen`, so recent-searches, cooldown, validation and React Query caching all apply as for a typed search.
- F12. If the list is missing, empty, or malformed, render nothing (no placeholder, no error).
- F13. No new dependency and no native code (AGENTS.md). Use `expo-haptics` and `@expo/vector-icons`, which the card already imports.
- F14. Web frontend: out of scope here, but the same field is available to it later.

## 5. Non-functional requirements
- N1. **Latency:** the overview's p95 must not rise by more than 300 ms over today's. Measure from the existing `latencyMs` in `AiOverviewLog`.
- N2. **Cost:** cost per uncached overview must stay within 1.5x of today's under A, or under C within the price of one Flash-Lite call. Check against the GCP billing SKU before rollout.
- N3. **Rate limit:** no change (40/hour). Tapping a chip counts as a normal search and overview request.
- N4. **Safety:** follow-ups derive from the same grounded corpus. Adversarial queries keep `ignoreAdversarialQuery`, and get no follow-ups (F5).
- N5. **Accessibility:** each chip has `accessibilityRole="button"` and a label equal to its text. Touch target at least 44 px high.

## 6. Plan (in order)

1. **Spike (backend only, no shipping).** With the service account, call `engines/{id}/servingConfigs/default_search:answer` (try v1, then v1alpha) with `relatedQuestionsSpec: { enable: true }`, `answerGenerationSpec.includeCitations: true`, and 5 to 10 real student queries. Record: does it succeed, where `relatedQuestions` sits in the response, quality of the questions, citation shape, latency, and per-call price. Compare answer quality with the current Search summary. Decision: A or C.
2. **Backend.** Implement F1 to F8 in `aiOverviewService.js` and the route. Extend `tests/unit/services.aiOverview.test.js` and `tests/integration/api.test.js`.
3. **Deploy the server.** Verify with `curl` that an old-shaped request still returns the same fields plus `relatedQuestions`.
4. **App.** Implement F9 to F12, bump the version, add a CHANGELOG entry, release through the GitHub Actions workflow (no `eas build`).
5. **Monitor** for a week via `manage_ai_overview` usage stats, then remove the Search-summary fallback (F8) if unused.

## 7. Acceptance criteria
- A request as sent by app 1.0.5 (`{ query }` only) gets a 200 with all pre-existing fields identical in shape, and no old client change is needed. Confirmed by installing 1.0.5 against the new server: card, citations, Sources sheet and copy/share still work.
- With follow-ups disabled by flag, or Discovery Engine failing on the follow-up part, the overview still renders and `relatedQuestions` is `[]`.
- New app: 2 to 4 chips appear for a summary-seeking query such as "what is ai", none for a lookup query such as "DBMS 2022 paper", and tapping a chip runs that search and shows a fresh overview.
- New app against the old server, and against a persisted cache from 1.0.5: no chips, no crash.
- Unit tests cover normalisation (F3), empty and failed follow-ups (F4, F5), and cache round-trip (F6).

## 8. Risks and open questions

| # | Item | Mitigation |
|---|---|---|
| 1 | Engine may lack Enterprise or Generative Responses, so `relatedQuestionsSpec` fails | Spike first; fall back to option C |
| 2 | Answer API citation shape differs from Search summary, so the Sources sheet could break | Map to the existing shape, test with real queries, keep the Search fallback (F8) |
| 3 | Answer API pricing may differ per call | Check SKU in the spike; N2 gate before rollout |
| 4 | Poor or off-topic follow-ups | Dedupe and filter (F3); the runtime switch (F7) lets an admin turn them off through MCP with no release |
| 5 | Chip tap causes extra billed overviews | Same 40/hour limiter applies; server cache absorbs repeats |
| 6 | **Open:** should a tapped follow-up carry the previous query as context (Answer API `session`)? | Assumed no for v1 (out of scope); revisit if follow-ups feel context-blind |
| 7 | **Open:** ship to the web frontend at the same time? | Assumed later; the field is already there |

## 9. Notes
- `SearchScreen.tsx` currently has uncommitted local edits. F11 should be built on top of them, not over them.
- The server repo is at `D:\projects\PYQDECK\server`, and this SRS changes it too. Track it in that repo's own branch and PR.

## 10. Implementation status
Implemented on branch `feat/ai-chat-followups` (server and app, not committed). The overview uses the Answer API while `ai_followups_enabled` is on, with automatic fallback to the Search-summary path if the call fails. On the Answer path `citations` is sent as `[]` (the card only uses `references`). Live check on the real engine returned 4 normalised follow-ups and 10 references for "what is artificial intelligence". Latency across three query types was 5.7 to 7.0 s for the Answer path versus 3.5 to 9.8 s for the old Search path, so no clear regression, but timings are noisy.
