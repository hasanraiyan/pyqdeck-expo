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
- A secure viewer screen: page-by-page images, expiring signed URLs, no save/share affordances, screenshot/screen-recording block while open, per-user visible watermark.
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
| Watermark | The student's identity (name/email) tiled visibly across each page, making leaks traceable |
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
2. **Expo app**: a "View original paper" button on the year's question list and a hardened viewer screen (secure flag, no save UI, watermark).
3. **Clerk identity**: the watermark and the signed-URL session are keyed to the signed-in account.

### 2.2 Product functions (summary)

1. Offer "View original paper" on a year's question list when originals exist for that subject/year.
2. Open the full paper in a page viewer (swipe/scroll pages, pinch zoom).
3. Block screenshots and screen recording while the viewer is open; restore normal capture when it closes.
4. Show no download, share, save, or open-in-browser affordance anywhere in the flow.
5. Overlay a per-account visible watermark on every page.
6. Serve every page through authed, expiring signed URLs; never expose a permanent public URL.
7. Let an admin upload, replace, or remove a year's original pages without a redeploy.

### 2.3 User classes and characteristics

| Class | Viewer behavior |
|---|---|
| Signed-out student | No viewer access (see FR-PAPER-8 for the rationale). Sees the button's absence, never a locked screen. |
| Signed-in standard student | Full viewer access with identity watermark, where originals exist. |
| Signed-in ad-free student | Same viewer access; ad-free changes ads only, not papers. |
| Admin | Same viewer access, plus upload/replace/remove tooling. |

### 2.4 As-is starting point (why this SRS is spec-first)

- The `Question` model stores retyped text only; no model holds scans, PDFs, or page images.
- The paper-parsing pipeline deletes source PDFs/images after transcription; only extracted diagrams survive.
- Therefore: no API serves originals, no admin tool manages them, and the app has no PDF library, no screen-capture protection, and no watermarking.
- Every backend requirement below (§3.2) is new work; the viewer (§3.1) is developed against placeholder pages until the first real upload lands.

### 2.5 Constraints

- Expo SDK 57 is the ceiling: screen-capture protection goes through `expo-screen-capture` (the Expo-blessed route for FLAG_SECURE); a custom config plugin is allowed only if the Expo library genuinely cannot do it (per `AGENTS.md`).
- The viewer must work on the same device matrix as the app (phones, tablets, rail/sidebar shells); watermark and secure flag must hold in all of them.
- Signed URLs must expire fast enough that a copied link is useless within minutes (**TBD-3** recommends 5–15 minutes with per-page refresh on demand).
- No permanent public URL for any original page may ever be emitted by any endpoint, log, or error message.

### 2.6 Honest limits (stated so they are never promised)

1. A second phone photographing the screen cannot be detected or blocked.
2. A rooted/jailbroken device can defeat FLAG_SECURE and memory protections.
3. A determined user can retype or trace what they see.
4. The watermark does not prevent copying; it identifies the source account afterwards.

These limits are documented in-product nowhere (no scary copy for students); they exist here so scope disputes end at this section.

### 2.7 Assumptions and dependencies

- Originals arrive as ordered page images (PDF ingestion, if ever needed, converts to page images server-side first — the app never renders PDF directly).
- Cloudinary (or equivalent) private/authenticated delivery remains available for hosted pages.
- Clerk identity remains the account key for watermarking and URL sessions.
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
| FR-PAPER-6 | M | Every page SHALL carry a visible watermark identifying the viewing account (display name and/or email, tiled or banded — **TBD-2**), rendered as an overlay that scrolls and zooms with the page (never a fixed header/footer that a crop removes trivially). |
| FR-PAPER-7 | M | Each page image SHALL be fetched with its own short-lived signed URL (Authorization-header session, never a token in a shareable query string — **TBD-4**). A URL that returns 403/expired SHALL surface a quiet per-page retry (one refresh of that page's URL), never a full-screen error, and never the raw URL. |
| FR-PAPER-8 | M | Opening the viewer SHALL require sign-in: a signed-out tap SHALL route through the existing auth guard (park → sign-in sheet → open on return), so every viewing session has an identity for the watermark and URL audit. |
| FR-PAPER-17 | M | Opening the viewer SHALL be watch-to-unlock: after sign-in, a rewarded ad (AdMob rewarded unit) plays first and the paper opens only on earned reward. A completed watch SHALL unlock that paper for the rest of the app session (in-memory; reopening after back-navigation asks no second ad, a restart asks again). Ad-free accounts, the global ads kill switch, ad-module absence, and ad load/show failures SHALL open the paper straight through (fail-open — content is never blocked by an ad problem). Closing the ad early SHALL stay on the question list. |
| FR-PAPER-9 | S | The button SHALL indicate availability without layout shift: the year row reserves no space for a missing button, and availability resolves with the same fetch that loads the year's questions (no extra spinner). |
| FR-PAPER-10 | C | The viewer MAY offer a low-light (dim) reading toggle, provided it never weakens the watermark contrast below legibility. |

### 3.2 Backend (server)

| ID | Priority | Requirement |
|---|---|---|
| FR-PAPER-11 | M | The backend SHALL store paper assets per subject/year: ordered pages (page number, private image reference, dimensions), uploader, and timestamps. One paper per subject/year (re-upload replaces). |
| FR-PAPER-12 | M | The question-list payload (or a lightweight sibling field) SHALL include a boolean `hasOriginal` per subject/year so the app shows the button with no extra round trip. |
| FR-PAPER-13 | M | A per-account endpoint (e.g. `GET /api/me/papers/:subject/:year`, private no-store, 401 when signed out) SHALL return that paper's pages as short-lived signed URLs minted for the requesting account, and SHALL log the issuance (account, paper, page count — identifiers only) for leak tracing. |
| FR-PAPER-14 | M | Signed URLs SHALL expire within minutes (**TBD-3**) and SHALL be bound to the viewing session/account where the storage provider allows it. Refresh of a single page's URL SHALL NOT require re-issuing the whole paper. |
| FR-PAPER-15 | M | An admin tool SHALL upload (ordered pages), replace, and remove a year's paper, with validation (image types, page count cap, size caps — **TBD-5**) and audit entries like all admin writes. Until originals exist, the tooling is exercised against placeholder uploads. |
| FR-PAPER-16 | M | No endpoint, log, or error body SHALL EVER emit a permanent public URL for an original page. Storage SHALL use private/authenticated delivery; any public-delivery misconfiguration SHALL fail closed (no URL issued). |

### 3.3 Non-functional requirements

| ID | Priority | Requirement |
|---|---|---|
| NFR-PAPER-1 | M | Opening the viewer from the button SHALL feel instant: first page visible within the existing question-list fetch budget on a decent connection; placeholders/skeletons, never blank screens or spinners that block back-navigation. |
| NFR-PAPER-2 | M | Protection must cost nothing when unused: the secure flag is set only while the viewer is focused; signed-URL minting happens only on viewer open and per-page refresh. |
| NFR-PAPER-3 | M | Offline: without connectivity the viewer SHALL NOT open from cache (pages are never cached on disk). The button may remain visible; tapping it offline explains "needs internet" in one line. |
| NFR-PAPER-4 | S | Page images SHOULD be resolution-capped server-side (legible on phone, poor for print reuse) — deterrence through quality, exact caps in **TBD-5**. |
| NFR-PAPER-5 | M | Privacy: watermark identity comes from the already-known account (name/email); no new PII collection. URL-issuance logs hold identifiers only, retained like other telemetry (90 days). |

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
| TBD-2 | Watermark style: diagonal tile vs top/bottom band? | Recommend diagonal semi-transparent tile of `name · email`, repeating, rendered under page zoom transform. |
| TBD-3 | Signed-URL lifetime? | Recommend 10 minutes, per-page refresh on 403; whole-paper session token optional later. |
| TBD-4 | Auth transport: header session vs URL token? | Recommend Authorization header (nothing shareable in the URL); fall back to single-use URL tokens only if the image component cannot set headers. |
| TBD-5 | Upload caps: page count, file size, resolution ceiling? | Recommend ≤ 20 pages, ≤ 5 MB/page in, ≤ 1600px long-edge served. Confirm with content owner. |
| TBD-6 | Website originals? | Explicitly undecided; web cannot enforce FLAG_SECURE, so default is app-only until a web protection story exists. |

---

## 4. Traceability

### 4.1 Viewer → planned code

| Requirement | Planned change |
|---|---|
| FR-PAPER-1 (button) | `src/screens/QuestionListScreen.tsx` (year selected + `hasOriginal` from question-list payload) |
| FR-PAPER-2/4/5/7 (viewer) | New `src/screens/OriginalPaperScreen.tsx` + new `src/api` fetcher; `expo-image` with memory-only caching, selection/long-press disabled |
| FR-PAPER-3 (capture block) | `expo-screen-capture` prevent/allow around viewer focus (verify exact SDK-57 API at implementation) |
| FR-PAPER-6 (watermark) | Overlay component fed by Clerk profile (`useUser`), inside the page zoom transform |
| FR-PAPER-8 (sign-in gate) | Existing `useRequireAuth` guard with a new `reason` (e.g. `'paper'`) + `SignInScreen` heading |
| FR-PAPER-9 (no layout shift) | Availability rides the existing `questionsQuery` payload (`hasOriginal` boolean) |

### 4.2 Backend → planned code

| Requirement | Planned change |
|---|---|
| FR-PAPER-11 (asset model) | New `server/models/PaperAsset.js` (subject, year, pages[], uploader, timestamps) |
| FR-PAPER-12 (`hasOriginal`) | Question-list service payload extension (cheap existence check, cached) |
| FR-PAPER-13/14 (signed URLs) | New `GET /api/me/papers/:subject/:year` route + minting service; issuance log (identifiers only) |
| FR-PAPER-15 (admin tooling) | Admin tool (upload/replace/remove) + audit, exercised with placeholder uploads first |
| FR-PAPER-16 (never public) | Private/authenticated storage delivery; fail-closed issuance |

---

## 5. Acceptance criteria (suggested, against placeholder data)

1. Year with `hasOriginal=true`: exactly one "View original paper" button; year without: no button and no gap where it would be.
2. Signed-out tap routes through sign-in and opens the paper on return; signed-in tap opens directly.
3. All pages load, swipe/scroll works, pinch zoom works, watermark (test account identity) is visible on every page at every zoom and scroll position.
4. Android: screenshot and screen recording while viewing produce black/blank output; leaving the viewer restores capture. No save/share/long-press-save control exists anywhere in the flow.
5. Network log shows only short-lived URLs; replaying a captured URL after expiry fails; no permanent paper URL appears in any response, log, or error.
6. Airplane mode: tapping the button explains offline in one line; no cached pages open.
7. Admin placeholder upload → button appears; replace → new pages; remove → button disappears. Every write audited.
