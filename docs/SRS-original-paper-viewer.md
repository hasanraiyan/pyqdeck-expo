# Software Requirements Specification (SRS): Original Paper Viewer

Structured after IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications).

| Field | Value |
|---|---|
| Product | PyQdeck mobile app (`pyqdeck-expo`) + PyQdeck backend (`server`, paper assets + signed access only) |
| Version of product | 1.8.0 (`package.json`, `app.json`) |
| Document version | 1.0 (draft) |
| Date | 2026-10-11 |
| Status | Draft; requires stakeholder review. No original paper assets exist in the system yet — this SRS assumes they will be uploaded later (§2.4) and the viewer is built against placeholder data until then. |
| Audience | Product owner, developers, QA, reviewers |

Requirement IDs: `FR-PAPER-` functional, `NFR-PAPER-` non-functional, `IR-PAPER-` interface, `CR-PAPER-` constraint. Priority uses MoSCoW (M = must, S = should, C = could). Items marked **TBD** need a decision or a measurement.

---

## 1. Introduction

### 1.1 Purpose

This SRS defines a "View original paper" capability: from a year's question list, a student opens the real paper (page images of the original scan) in a viewer that makes downloading or saving as hard as reasonably possible. It is the reference for development, testing, and acceptance of the viewer, the backend paper-asset plumbing, and the admin upload path.

### 1.2 Scope

In scope:

- A per-year "View original paper" button on the question list screen, opening the full paper for the selected year.
- A secure viewer screen: page-by-page images, expiring signed URLs, no save/share affordances, screenshot/screen-recording block while open, standard banner + interstitial ads.
- Backend paper-asset storage model, authed signed-URL endpoint, and admin upload/replace tooling.
- Placeholder-data development: the viewer ships against mock pages until real originals are uploaded.

Out of scope for this SRS:

- Sourcing, scanning, or uploading the actual originals (a content-pipeline job that follows this spec; §2.4).
- Per-question page crops (a later revision may add them without changing this SRS's paper-level flow).
- True prevention of copying: screenshots via a second device, rooted devices, and reconstruction from memory cannot be stopped on-device and are explicitly not claimed (§2.6).
- House ads, AdSense, and the `pyqdeck-frontend` website. Whether the website ever shows originals is undecided (**TBD-6**).

### 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
|---|---|
| Original paper | The scanned page images of a real BEU exam paper for one subject and year |
| Paper-level | One viewer session covers the whole year's paper, not one question |
| Signed URL | A time-limited URL that stops working after expiry; leaking it later is useless |
| FLAG_SECURE | Android window flag that blanks the app in screenshots and screen recordings |
| Best-effort protection | Blocking the easy paths (download, save, screenshot, recording) while documenting what cannot be blocked |
| Placeholder data | Mock page images/URLs the viewer is developed and tested against until real originals exist |

### 1.4 References

- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications.
- `AGENTS.md`: Expo SDK 57 and build rules (Expo libraries first; native only via config plugin; no `eas build`).
- `docs/SRS-pyqdeck-app.md`: app-level SRS.
- `docs/SRS-advertisements.md`: SRS pattern for a cross-repo (expo + server) feature with phased delivery.
- Code: `src/screens/QuestionListScreen.tsx`, `src/components/ImageViewerModal.tsx`, `src/utils/mobileAds.ts` (guarded-require pattern), `src/auth/useRequireAuth.ts` (sign-in gate pattern), server `server/models/Question.js` (typed-text-only precedent).

### 1.5 Overview

Section 2 describes the product context, the as-is starting point (no originals exist), user classes, and the honest limits of copy protection. Section 3 lists the requirements. Section 4 is a traceability table.

---

## 2. Overall description

### 2.1 Product perspective

Today a year's questions exist only as retyped text. The original paper viewer adds a parallel, privileged representation: page images served per request, viewable but not collectible. It touches three layers:

1. **Backend**: stores page images per subject/year (private Cloudinary delivery or equivalent), mints short-lived signed URLs per viewing session for the requesting account, and gives admins an upload/replace path.
2. **Expo app**: a "View original paper" button on the year's question list and a hardened viewer screen (secure flag, no save UI, standard ads).
3. **Clerk identity**: viewer access requires sign-in; signed-URL sessions are keyed to the signed-in account.

### 2.2 Product functions (summary)

1. Offer "View original paper" on a year's question list when originals exist for that subject/year.
2. Open the full paper in a page viewer (swipe/scroll pages, pinch zoom).
3. Block screenshots and screen recording while the viewer is open; restore normal capture when it closes.
4. Show no download, share, save, or open-in-browser affordance anywhere in the flow.
5. Serve every page through authed, expiring signed URLs; never expose a permanent public URL.
6. Let an admin upload, replace, or remove a year's original pages from inside the Android app (no MCP upload path — MCP cannot carry images), without a redeploy.
7. Carry the app's standard ads: shared-budget interstitial on open, bottom banner under the page list and the zoom view.

### 2.3 User classes and characteristics

| Class | Viewer behavior |
|---|---|
| Signed-out student | No viewer access (see FR-PAPER-8 for the rationale). Sees the button's absence, never a locked screen. |
| Signed-in standard student | Full viewer access, where originals exist. |
| Signed-in ad-free student | Same viewer access; ad-free changes ads only, not papers. |
| Admin | Same viewer access, plus in-app paper management (upload / replace / remove) on the question list screen. |

### 2.4 As-is starting point (why this SRS is spec-first)

- The `Question` model stores retyped text only; no model holds scans, PDFs, or page images.
- The paper-parsing pipeline deletes source PDFs/images after transcription; only extracted diagrams survive.
- Therefore: no API serves originals, no admin tool manages them, and the app has no PDF library and no screen-capture protection.
- Every backend requirement below (§3.2) is new work; the viewer (§3.1) is developed against placeholder pages until the first real upload lands.

### 2.5 Constraints

- Expo SDK 57 is the ceiling: screen-capture protection goes through `expo-screen-capture` (the Expo-blessed route for FLAG_SECURE); a custom config plugin is allowed only if the Expo library genuinely cannot do it (per `AGENTS.md`).
- The viewer must work on the same device matrix as the app (phones, tablets, rail/sidebar shells); the secure flag and ads must hold in all of them.
- Signed URLs must expire fast enough that a copied link is useless within minutes (**TBD-3** recommends 5–15 minutes with per-page refresh on demand).
- No permanent public URL for any original page may ever be emitted by any endpoint, log, or error message.

### 2.6 Honest limits (stated so they are never promised)

1. A second phone photographing the screen cannot be detected or blocked.
2. A rooted/jailbroken device can defeat FLAG_SECURE and memory protections.
3. A determined user can retype or trace what they see.

These limits are documented in-product nowhere (no scary copy for students); they exist here so scope disputes end at this section.

### 2.7 Assumptions and dependencies

- Originals arrive as ordered page images (PDF ingestion, if ever needed, converts to page images server-side first — the app never renders PDF directly).
- Cloudinary (or equivalent) private/authenticated delivery remains available for hosted pages.
- Clerk identity remains the account key for viewer access and URL sessions.
- `expo-screen-capture` (or its SDK-57 successor) provides set-and-restore capture protection; exact API verified at implementation.

---

## 3. Requirements

### 3.1 Viewer (Expo app)

| ID | Priority | Requirement |
|---|---|---|
| FR-PAPER-1 | M | On the question list screen, when a single year is selected AND the backend reports originals for that subject/year, the app SHALL show one "View original paper" button (paper-level, not per question). When no year is selected, or no originals exist, the button SHALL be absent entirely (no disabled state, no placeholder). |
| FR-PAPER-2 | M | Tapping the button SHALL open a dedicated viewer screen for the full year's paper: vertical page list (or horizontal pager — **TBD-1**), pinch-to-zoom per page, page position indicator ("Page 2 of 8"). |
| FR-PAPER-3 | M | While the viewer screen is focused, the app SHALL enable OS-level capture protection (FLAG_SECURE via the Expo screen-capture route) blocking screenshots and screen recordings; on blur/unmount it SHALL restore the previous state. If the protection API is unavailable, the viewer SHALL still open (viewing degrades, never breaks). |
| FR-PAPER-4 | M | The viewer SHALL offer no download, share, save-to-gallery, copy-link, or open-in-browser control. Page images SHALL NOT be written to the gallery, downloads, or any user-visible file; in-memory caching only. |
| FR-PAPER-5 | M | Long-press context menus and text/image selection on pages SHALL be disabled (no save-image-on-long-press path on either platform). |
| FR-PAPER-6 | — | REMOVED (2026-10-11): the identity watermark overlay was dropped from the viewer and zoom; copy protection rests on capture blocking + no-save UI only. |
| FR-PAPER-7 | M | Each page image SHALL be fetched with its own short-lived signed URL (Authorization-header session, never a token in a shareable query string — **TBD-4**). A URL that returns 403/expired SHALL surface a quiet per-page retry (one refresh of that page's URL), never a full-screen error, and never the raw URL. |
| FR-PAPER-8 | M | Opening the viewer SHALL require sign-in: a signed-out tap SHALL route through the existing auth guard (park → sign-in sheet → open on return), so every viewing session has an identity for the URL audit. |
| FR-PAPER-17 | M | The viewer SHALL carry the app's standard ads, no gates: opening it counts as a content open toward the shared interstitial budget (every 4th open, 2-minute cooldown, `recordContentOpenedAndMaybeShowInterstitial`), and a bottom banner SHALL sit under the page list AND under the zoom view (both render nothing when the kill switch or ad-free entitlement gates ads off). |
| FR-PAPER-9 | S | The button SHALL indicate availability without layout shift: the year row reserves no space for a missing button, and availability resolves with the same fetch that loads the year's questions (no extra spinner). |
| FR-PAPER-10 | C | The viewer MAY offer a low-light (dim) reading toggle. |

### 3.2 Backend (server)

| ID | Priority | Requirement |
|---|---|---|
| FR-PAPER-11 | M | The backend SHALL store paper assets per subject/year: ordered pages (page number, private image reference, dimensions), uploader, and timestamps. One paper per subject/year (re-upload replaces). |
| FR-PAPER-12 | M | The question-list payload (or a lightweight sibling field) SHALL include a boolean `hasOriginal` per subject/year so the app shows the button with no extra round trip. |
| FR-PAPER-13 | M | A per-account endpoint (e.g. `GET /api/me/papers/:subject/:year`, private no-store, 401 when signed out) SHALL return that paper's pages as short-lived signed URLs minted for the requesting account, and SHALL log the issuance (account, paper, page count — identifiers only) for leak tracing. |
| FR-PAPER-14 | M | Page URLs SHALL be server-signed (authenticated delivery: only server-minted URLs resolve) with a client-side refresh contract (`refreshAfter` ~10 min, **TBD-3**; the app re-fetches by then and treats stale URLs as expired). Honest limit: true self-expiring URLs need Cloudinary token auth (Advanced plan) — until then mitigation is unguessable signatures + short refresh discipline, never public delivery. |
| FR-PAPER-15 | M | Paper management SHALL live in the Android app, not in MCP (MCP cannot transport images). On the question list screen with a year selected, an admin holding the `manage_papers` grant SHALL see a "Manage paper" entry alongside the student button: with no paper it offers upload-new; with a paper it shows page count + upload date with replace and remove actions. Every upload/replace/remove SHALL be audited like all admin writes. |
| FR-PAPER-16 | M | No endpoint, log, or error body SHALL EVER emit a permanent public URL for an original page. Storage SHALL use private/authenticated delivery; any public-delivery misconfiguration SHALL fail closed (no URL issued). |
| FR-PAPER-23 | M | Upload sources SHALL be camera capture ("scan") and gallery multi-pick (new `expo-image-picker` dependency, runtime camera + media-library permissions via Expo config). Picked pages SHALL be reviewable/reorderable before upload, within validation caps (image types, ≤20 pages, ≤10 MB each — **TBD-5**). Replace and remove SHALL confirm first (replace overwrites, remove deletes); all three SHALL be audited. |
| FR-PAPER-24 | M | Uploads SHALL travel app → backend → Cloudinary (multipart POST to an admin endpoint; the Cloudinary secret never ships in the app — **TBD-9**), with visible progress and a quiet retry on failure. A finished upload SHALL flip `hasOriginal` so the student button appears without an app update. |

> NOTE (2026-10-11): the watch-to-unlock gate with server-persisted unlocks + SSV verification (former FR-PAPER-18–22) was deliberately removed — the viewer opens directly and ads in the app are the single bottom banner only. The design is kept in git history if it is ever revived.

### 3.3 Non-functional requirements

| ID | Priority | Requirement |
|---|---|---|
| NFR-PAPER-1 | M | Opening the viewer from the button SHALL feel instant: first page visible within the existing question-list fetch budget on a decent connection; placeholders/skeletons, never blank screens or spinners that block back-navigation. |
| NFR-PAPER-2 | M | Protection must cost nothing when unused: the secure flag is set only while the viewer is focused; signed-URL minting happens only on viewer open and per-page refresh. |
| NFR-PAPER-3 | M | Offline: without connectivity the viewer SHALL NOT open from cache (pages are never cached on disk). The button may remain visible; tapping it offline explains "needs internet" in one line. |
| NFR-PAPER-4 | S | Page images SHOULD be resolution-capped server-side (legible on phone, poor for print reuse) — deterrence through quality, exact caps in **TBD-5**. |
| NFR-PAPER-5 | M | Privacy: no new PII collection for the viewer. URL-issuance logs hold identifiers only, retained like other telemetry (90 days). |

### 3.4 Interface requirements

| ID | Priority | Requirement |
|---|---|---|
| IR-PAPER-1 | M | New per-account endpoint per FR-PAPER-13: JSON over HTTPS, Clerk-authenticated, `Cache-Control: private, no-store`, machine-readable codes (`unauthenticated`, `no_original`, `url_expired`). |
| IR-PAPER-2 | M | Admin upload/replace tooling SHALL follow existing admin-tool shapes (validated inputs, `NotFoundError`/`ValidationError` semantics, audit entries). |
| IR-PAPER-3 | M | Capture protection SHALL go through the Expo screen-capture library, guarded like the AdMob module (absent API = viewer still works, unprotected). Direct native edits require the config-plugin route with a commit note per `AGENTS.md`. |

### 3.5 Constraints

| ID | Priority | Requirement |
|---|---|---|
| CR-PAPER-1 | M | Copy protection is best-effort by physics (§2.6); no requirement in this SRS SHALL be read as promising otherwise. |
| CR-PAPER-2 | M | The app SHALL NEVER render a PDF directly: page images only, so there is no document file to hand to another app. |
| CR-PAPER-3 | M | Placeholder development: every viewer requirement MUST be demonstrable against mock pages before any real original exists. |

### 3.6 Open decisions (TBD)

| ID | Question | Recommendation |
|---|---|---|
| TBD-1 | Vertical list vs horizontal pager? | Recommend vertical scroll list (matches question-list reading, simpler zoom); pager only if QA finds list jank on low-end phones. |
| TBD-2 | — | REMOVED (2026-10-11) with the watermark (FR-PAPER-6). |
| TBD-3 | Refresh interval? | Recommend 10 minutes client-side refresh; whole-paper session token optional later. True URL self-expiry (token auth) only with an Advanced-plan upgrade. |
| TBD-4 | Auth transport: header session vs URL token? | Recommend Authorization header (nothing shareable in the URL); fall back to single-use URL tokens only if the image component cannot set headers. |
| TBD-5 | Upload caps: page count, file size, resolution ceiling? | Recommend ≤ 20 pages, ≤ 5 MB/page in, ≤ 1600px long-edge served. Confirm with content owner. |
| TBD-6 | Website originals? | Explicitly undecided; web cannot enforce FLAG_SECURE, so default is app-only until a web protection story exists. |
| TBD-7 | — | REMOVED (2026-10-11) with the unlock gate. |
| TBD-8 | — | REMOVED (2026-10-11) with the unlock gate + SSV plan (kept in git history). |
| TBD-9 | Upload path: app → backend → Cloudinary, or direct unsigned upload preset? | Recommend via-backend multipart POST (secret stays server-side, validation + audit in one place); direct preset only if backend upload throughput becomes a problem. |
| TBD-10 | Scan enhancement (edge detect, perspective fix)? | Recommend plain camera capture first; add a scanner SDK only if admins complain about quality. |

---

## 4. Traceability

### 4.1 Viewer → planned code

| Requirement | Planned change |
|---|---|
| FR-PAPER-1 (button) | `src/screens/QuestionListScreen.tsx` (year selected + `hasOriginal` from question-list payload) |
| FR-PAPER-2/4/5/7 (viewer) | `src/screens/OriginalPaperScreen.tsx` (signed pages via `paperPagesQuery`, dev placeholder fallback, loader/error/retry states) + `src/components/OriginalPaperViewer.tsx`; `expo-image` with memory-only caching, selection/long-press disabled; zoom via WebView surface |
| FR-PAPER-3 (capture block) | `expo-screen-capture` `usePreventScreenCapture` while the viewer is mounted, guarded fallback (`src/utils/screenCapture.ts`) |
| FR-PAPER-17 (viewer ads) | `recordContentOpenedAndMaybeShowInterstitial` on viewer open (shared budget); `AdBanner` under page list and zoom view |
| FR-PAPER-8 (sign-in gate) | Existing `useRequireAuth` guard with `reason: 'paper'` + `SignInScreen` heading |
| FR-PAPER-9 (no layout shift) | Availability rides the existing `questionsQuery` payload (`hasOriginal` boolean) |

### 4.2 Backend → planned code

| Requirement | Planned change |
|---|---|
| FR-PAPER-11 (asset model) | New `server/models/PaperAsset.js` (subject, year, pages[], uploader, timestamps) |
| FR-PAPER-12 (`hasOriginal`) | Question-list service payload extension (cheap existence check, cached) |
| FR-PAPER-13/14 (signed URLs) | New `GET /api/me/papers/:subject/:year` route + minting service; issuance log (identifiers only) |
| FR-PAPER-15 (admin tooling) | New `manage_papers` grant + in-app manage sheet on the question list (upload-new / replace / remove) + audit, exercised with placeholder uploads first |
| FR-PAPER-16 (never public) | Private/authenticated storage delivery; fail-closed issuance |

---

## 5. Acceptance criteria (suggested, against placeholder data)

1. Year with `hasOriginal=true`: exactly one "View original paper" button; year without: no button and no gap where it would be.
2. Signed-out tap routes through sign-in and opens the paper on return; signed-in tap opens directly.
3. All pages load, swipe/scroll works, pinch zoom works, with no save/share control anywhere in the flow.
4. Android: screenshot and screen recording while viewing produce black/blank output; leaving the viewer restores capture. No save/share/long-press-save control exists anywhere in the flow.
5. Network log shows only short-lived URLs; replaying a captured URL after expiry fails; no permanent paper URL appears in any response, log, or error.
6. Airplane mode: tapping the button explains offline in one line; no cached pages open.
7. Admin placeholder upload → button appears; replace → new pages; remove → button disappears. Every write audited.
