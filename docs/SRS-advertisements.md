# Software Requirements Specification (SRS): Advertisements (Expo App)

Structured after IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications).

| Field | Value |
|---|---|
| Product | PyQdeck mobile app (`pyqdeck-expo`) + PyQdeck backend (`server`, entitlement + kill switch only) |
| Version of product | 1.7.3 (`package.json`, `app.json`) |
| Document version | 1.0 (draft) |
| Date | 2026-10-11 |
| Status | Draft, reverse-engineered from the codebase for as-built behavior (§2.4–§2.5) plus new ad-free requirements (§3.3); requires stakeholder review |
| Audience | Product owner, developers, QA, reviewers |

Requirement IDs: `FR-ADS-` functional, `NFR-ADS-` non-functional, `IR-ADS-` interface, `CR-ADS-` constraint. Priority uses MoSCoW (M = must, S = should, C = could). Items marked **TBD** need a decision or a measurement.

---

## 1. Introduction

### 1.1 Purpose

This SRS defines what the PyQdeck Android app must do about paid advertising, and how selected users are exempted from it. It is the reference for development, testing, and acceptance of:

1. The as-built Google AdMob integration (banner + interstitial) in `pyqdeck-expo`.
2. The new per-user ad-free entitlement (`adFree`) and the global ads kill switch, which let the product owner hide ads for some users without a redeploy.

### 1.2 Scope

In scope:

- Banner ads (AdMob) in the Expo app: where they render, what size, retry behavior, and failure rendering.
- Interstitial ads (AdMob) in the Expo app: preload, trigger points, frequency caps, cooldown.
- Ad SDK initialization at boot and dev-vs-release unit IDs.
- New server-side per-user `adFree` flag: storage, per-account entitlement endpoint, admin set/unset (audited).
- New global `adsEnabled` kill switch in remote app config.
- New client-side gating: every ad surface checks the kill switch and the entitlement before requesting or showing an ad.

Out of scope for this SRS:

- House/cross-promotion ads (`HouseAd`, `AdLog`, `/api/public/ads`, `manage_ads` tool) and the `pyqdeck-frontend` AdSense/HouseAd web surfaces. A future revision may extend the same `adFree` entitlement to those surfaces, but no web behavior is specified here.
- Ad mediation, rewarded ads, native ads, and any new ad format.
- Revenue reporting (AdMob console remains the source of truth for paid-ads revenue).
- The `pyqdeck-gate` content pipeline and the `pyqdeck-android` native shell, except insofar as the release build must contain the AdMob native module.

### 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
|---|---|
| AdMob | Google Mobile Ads SDK (`react-native-google-mobile-ads`), serving paid banner and interstitial ads |
| Banner | A rectangular paid ad pinned to the bottom of a screen (`AdBanner`) |
| Interstitial | A full-screen paid ad shown at a transition point |
| No-fill | AdMob has no creative to serve (`[banner/no-fill]`); transient, not a bug |
| Anchored adaptive banner | Full-width banner size used on phones (`BannerAdSize.ANCHORED_ADAPTIVE_BANNER`) |
| Leaderboard | Fixed 728×90 banner size used on tablets (`BannerAdSize.LEADERBOARD`) |
| Entitlement | The per-account answer to "is this user ad-free?" |
| `adFree` | The new per-user flag; `true` means no paid ads for that account |
| Kill switch | The new global `flags.adsEnabled` remote-config flag; `false` hides ads for everyone |
| Fail-open (ads) | When the entitlement is unknown (offline, error), ads are shown; ad-free is the exception that must be proven, not assumed |
| Guarded require | The `try { require(...) }` pattern in `src/utils/mobileAds.ts` for the AdMob native module |
| Clerk | Account/session provider; the identity the entitlement is keyed to |

### 1.4 References

- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications.
- `AGENTS.md`: Expo SDK 57 and build rules (no `eas build`; release via GitHub Actions `release.yml`).
- `docs/SRS-pyqdeck-app.md`: app-level SRS (AdMob listed as a platform-service dependency, §2.1).
- `docs/SRS-admin-features.md` / `docs/SRS-admin-in-app.md`: admin tooling conventions (narrow user actions, audited writes).
- `docs/SRS-account-progress-sync-*.md`: `/api/me` conventions (private `no-store`, 401 `unauthenticated`, 503 `sync_disabled` patterns).
- AdMob docs: banner guidance, interstitial guidance, 30 s minimum refresh guidance (cited in code comments).
- Code: `src/components/AdBanner.tsx`, `src/utils/ads.ts`, `src/utils/mobileAds.ts`, `src/config/ads.ts`, `src/db/storageRegistry.ts`, `src/screens/*Screen.tsx`, `App.tsx`, server `server/services/appConfigService.js`, `server/services/userAdminService.js`, `server/routes/meRoutes.js`.

### 1.5 Overview

Section 2 describes the product context, the as-built ads behavior, user classes, and constraints. Section 3 lists the requirements (as-built preserved + new ad-free behavior). Section 4 is a traceability table.

---

## 2. Overall description

### 2.1 Product perspective

The Expo app is a standalone client with three runtime dependencies relevant to ads:

1. **Google AdMob SDK** (native module via `react-native-google-mobile-ads`). All paid ads come from here. The module may be absent (Expo Go, web preview build); the app must work with zero ads in that case.
2. **PyQdeck backend API**, which after this SRS additionally serves (a) the per-account ad-free entitlement and (b) the global ads kill switch inside remote app config.
3. **Clerk**, which identifies the signed-in account the entitlement is keyed to.

Ads are strictly auxiliary: every screen must be fully usable with ads absent, failed, or suppressed. No feature may depend on an ad loading or showing.

### 2.2 Product functions (summary)

1. Show a banner ad at the bottom of content screens (as-built set, §2.4).
2. Show a preloaded interstitial at content-open transitions, under a shared frequency cap (as-built, §2.5).
3. Initialize the Mobile Ads SDK and preload the interstitial once at boot.
4. (New) Resolve whether ads apply to the current user: global kill switch AND per-account `adFree` entitlement.
5. (New) Let an admin mark/unmark accounts ad-free (audited), and flip the global kill switch without a redeploy.

### 2.3 User classes and characteristics

| Class | Ads behavior |
|---|---|
| Signed-out student | Ads always apply (no account, hence no entitlement). |
| Signed-in standard student (`adFree=false`) | Ads apply. |
| Signed-in ad-free student (`adFree=true`) | No banner, no interstitial, on any device the account signs in to. |
| Admin | Ads apply like a standard student unless the account is itself marked ad-free; admins additionally operate the kill switch and per-user flags. |

There is no self-serve purchase or opt-out in this SRS: ad-free is granted by an admin. A future revision may add self-serve (e.g. subscription) without changing the gating semantics specified here.

### 2.4 As-built: banner ads (reverse-engineered, must be preserved)

- Component: `src/components/AdBanner.tsx`, rendered as the last element of a screen's root `View` (below the scroll content), wrapped in `SafeAreaView edges={['bottom']}`.
- Screens rendering `AdBanner` (exact as of v1.7.3): `AllSubjectsScreen`, `SubjectListScreen`, `SubjectDetailScreen`, `QuestionListScreen`, `QuestionDetailScreen`, `TopicNotesScreen`. Study-tab progress screens (`SemesterSelectScreen`, `SyllabusOverviewScreen`, `SubjectSyllabusScreen`) do not render banners.
- Sizes: phones → `ANCHORED_ADAPTIVE_BANNER`; tablets → `LEADERBOARD` (fixed 728×90 has broader demand than a very wide adaptive slot; see code comment).
- Unit IDs (`src/config/ads.ts`): dev/debug builds use AdMob `TestIds`; only release builds (`__DEV__ === false`) use the production IDs `ca-app-pub-6179737775385101/2841064525` (banner) and `ca-app-pub-6179737775385101/3967227754` (interstitial).
- Load-failure policy: transient failures (e.g. no-fill) retry up to `MAX_RETRIES = 3` with backoff `30 s × attempt` (Google's stated minimum refresh interval); after exhaustion the component renders `null` (collapses, no gap, no placeholder). Debug badges (`AD_DEBUG_UI`) stay `false` in production builds.
- Module absence: when the AdMob native module is unavailable (`adsAvailable === false`: Expo Go, web), the component renders `null`. Importing the SDK anywhere except through `src/utils/mobileAds.ts` is a defect.

### 2.5 As-built: interstitial ads (reverse-engineered, must be preserved)

- Module: `src/utils/ads.ts`. `initInterstitial()` is idempotent and is called once at boot after `mobileAds().initialize()` resolves (`App.tsx`); failures are swallowed.
- Trigger helper: `recordContentOpenedAndMaybeShowInterstitial()` (alias `recordQuestionOpenedAndMaybeShowInterstitial`, deprecated). Callers as of v1.7.3: `QuestionDetailScreen` (on `questionId` change) and `SyllabusOverviewScreen` (once per mount).
- Frequency policy (shared counter on purpose, not per screen): show at most every `OPENS_BEFORE_SHOW = 4` content opens AND at most once per `COOLDOWN_MS = 120 000` (2 minutes). Counter and last-shown timestamp persist in `AsyncStorage` (`interstitial_opens_since_last_shown`, `interstitial_last_shown_at`; registered in `src/db/storageRegistry.ts` as device-category keys).
- Preload model: one interstitial preloaded at init; `LOADED` sets a flag; `CLOSED` reloads the next one. If not loaded at decision time, the counter is kept (not reset) and nothing is shown.
- Failure/ad-unavailability semantics: any error (including `show()` rejection) is swallowed; navigation never waits on an ad.

### 2.6 Constraints

- AdMob program policies apply (frequency, no refresh abuse, no incentivized interaction). The caps in §2.5 exist partly for policy compliance; tightening them later is allowed, loosening them requires policy review.
- The Play Store Data Safety form describes current data collection. If the entitlement adds any new collected data type or recipient, the form must be updated before release (see **TBD-5**).
- `expo prebuild --clean` regenerates native projects; AdMob stays configured through the Expo package + config plugin route, not hand-edited native files (per `AGENTS.md`).
- The web/desktop preview build has no AdMob native module and therefore never shows paid ads, regardless of entitlement.

### 2.7 Assumptions and dependencies

- AdMob account, app ID, and the two production unit IDs remain valid and owned by the product.
- AdMob console (not this app, not the backend) remains the revenue source of truth.
- Backend availability follows existing behavior: ad gating must degrade gracefully (fail-open, §3.3) when the entitlement or config cannot be reached.
- Account identity continues to be Clerk `clerkId`, the same key used by progress/votes/settings.

---

## 3. Requirements

### 3.1 Paid-ads behavior (as-built, preserved)

| ID | Priority | Requirement |
|---|---|---|
| FR-ADS-1 | M | The app SHALL render an AdMob banner, via the shared `AdBanner` component, at the bottom of exactly these screens: All Subjects, Subject List, Subject Detail, Question List, Question Detail, Topic Notes. No other screen SHALL render a banner unless this SRS is amended. |
| FR-ADS-2 | M | `AdBanner` SHALL use `ANCHORED_ADAPTIVE_BANNER` on phones and `LEADERBOARD` on tablets, and SHALL render `null` (no placeholder, no gap) whenever the native ads module is unavailable, while loading has exhausted retries, or ads are gated off (§3.3). |
| FR-ADS-3 | M | Release builds SHALL use production unit IDs and dev/debug builds SHALL use AdMob test IDs, selected in one place (`src/config/ads.ts`). No screen SHALL hard-code a unit ID. |
| FR-ADS-4 | M | Banner load failures SHALL be retried at most 3 times with 30 s × attempt backoff, then collapse to `null`. Production builds SHALL NOT show debug badges. |
| FR-ADS-5 | M | The app SHALL initialize the Mobile Ads SDK once at boot and preload one interstitial (`initInterstitial`, idempotent); init failure SHALL NOT affect startup, navigation, or any feature. |
| FR-ADS-6 | M | The app SHALL offer an interstitial only from question opens (`QuestionDetailScreen`, per `questionId`) and semester-sheet opens (`SyllabusOverviewScreen`, per mount), through the single shared helper `recordContentOpenedAndMaybeShowInterstitial()`. New trigger points SHALL be added only with an update to this SRS. |
| FR-ADS-7 | M | Interstitial display SHALL respect the shared budget: at most every 4th content open AND at most once per 2 minutes, persisted across restarts in `AsyncStorage`. The budget SHALL be shared across trigger points, never per screen. |
| FR-ADS-8 | M | If no preloaded interstitial is ready at decision time, the app SHALL show nothing and SHALL keep (not reset) the open counter. Any error from the ads SDK SHALL be swallowed and SHALL never block or delay navigation. |
| FR-ADS-9 | M | All AdMob SDK access SHALL go through `src/utils/mobileAds.ts` (guarded require). Direct imports of `react-native-google-mobile-ads` elsewhere SHALL be treated as defects. |

### 3.2 Global kill switch (new)

| ID | Priority | Requirement |
|---|---|---|
| FR-ADS-10 | M | The backend SHALL add a global boolean flag `flags.adsEnabled` (default `true`) to remote app config (`AppConfig` model, `appConfigService` `FLAG_NAMES`/`DEFAULT_CONFIG`/`toPublic`, admin `manage_app_config` update path), following the existing `syncEnabled`/`settingsSyncEnabled`/`nudgesEnabled` pattern including the 5 s server cache. |
| FR-ADS-11 | M | The Expo app SHALL read `flags.adsEnabled` at launch with the existing app-config flow (cached copy first, background refresh, foreground refresh throttled as today). When `adsEnabled === false`, the app SHALL NOT request or show any banner or interstitial for any user, and SHALL NOT count content opens toward the interstitial budget. |
| FR-ADS-12 | S | The admin app-config screen/tooling SHOULD expose `adsEnabled` alongside the existing flags with the same audit behavior as other flag changes. |

### 3.3 Per-user ad-free entitlement (new)

| ID | Priority | Requirement |
|---|---|---|
| FR-ADS-13 | M | The backend SHALL store a per-account boolean `adFree` on the `User` model (default `false`, indexed **TBD-1**), keyed to `clerkId` like all other per-account data. Signed-out devices have no entitlement. |
| FR-ADS-14 | M | The backend SHALL serve the entitlement on a per-account endpoint under `/api/me` (private `Cache-Control: private, no-store`, 401 `unauthenticated` when signed out, following `meRoutes.js` conventions). Response shape: `{ "adFree": boolean }`. Whether this is a new `GET /api/me/ads` route or an extension of an existing per-account response is **TBD-2**; either way the response MUST NOT be edge-cacheable. |
| FR-ADS-15 | M | An admin SHALL be able to set and clear `adFree` for an account (by email or `clerkId`, mirroring `setBeta`), exposed through the `manage_users` admin tool as `set_ad_free` (or equivalent). Every write SHALL be audited with the same fields as `setBeta` (who, target, value, outcome). Reads SHALL surface `adFree` in admin `find`/`get` output alongside `isBeta`. Writes SHALL require an explicit value boolean; destructive-adjacent actions keep the existing `confirm: true` convention where applicable. |
| FR-ADS-16 | M | The Expo app SHALL gate every paid-ad surface on the conjunction: `flags.adsEnabled AND NOT entitlement.adFree`. When gated off, `AdBanner` SHALL render `null` and content opens SHALL NOT increment the interstitial counter nor trigger `show()`. Gating MUST apply equally to banner and interstitial; hiding one but not the other is a defect. |
| FR-ADS-17 | M | Signed-out users SHALL always be treated as ads-eligible (no entitlement fetch, no caching of another account's entitlement). On sign-out, any cached entitlement SHALL be discarded with the rest of the account data (same wipe path as progress). On sign-in (new account or account switch), the entitlement SHALL be (re)fetched before the next ad decision that requires network **TBD-3**. |
| FR-ADS-18 | M | When the entitlement cannot be resolved (offline, backend error, timeout), the app SHALL fail open: show ads as today. Ad-free is the exception and MUST be proven by a successful entitlement response, never assumed. The failure MUST be silent (no error UI) and MUST NOT block navigation or content. |
| FR-ADS-19 | S | The app SHOULD cache the last known entitlement per signed-in account in `AsyncStorage` (device category, registered in `storageRegistry.ts`), refresh it on sign-in, on foreground (throttled, reuse the app-config refresh moment), and after account sync completes. A stale cache MAY be used while a refresh is in flight. Exact TTL/refresh triggers are **TBD-4**. |
| FR-ADS-20 | C | The app MAY surface the ad-free state in Settings (e.g. an "Ad-free" row for ad-free accounts) for support clarity. It SHALL NOT explain how ad-free was granted beyond "Contact support" unless the product owner approves copy. |
| FR-ADS-21 | S | App insights SHOULD include counts of ad-free accounts (counts only, no emails/IDs), following the existing `insightsService`/`admin_app_insights` pattern. |

### 3.4 Non-functional requirements

| ID | Priority | Requirement |
|---|---|---|
| NFR-ADS-1 | M | Ads SHALL NOT delay first paint, navigation, boot, or content rendering. All ad SDK calls stay off the critical path (established behavior, extended to entitlement/config reads: cached-first, background refresh). |
| NFR-ADS-2 | M | With ads gated off (kill switch or ad-free), there SHALL be no layout gap, placeholder, or extra spacing where the banner would have been, and no interstitial-shaped jank (no pre-show UI). |
| NFR-ADS-3 | M | Ad frequency SHALL NOT regress: the §2.5 caps are upper bounds. Any future trigger point MUST share the same budget. |
| NFR-ADS-4 | S | Entitlement/config fetches SHOULD add negligible traffic: reuse existing launch/foreground/sync moments, throttle foreground refresh (10-minute pattern as app config), and avoid per-screen requests. |
| NFR-ADS-5 | M | Privacy: the entitlement flow SHALL NOT transmit topic ticks, votes, or any content beyond identity + the boolean. No ad SDK call SHALL be made for ad-free users (so no ad-request data leaves the device for them). Data Safety implications are **TBD-5**. |

### 3.5 Interface requirements

| ID | Priority | Requirement |
|---|---|---|
| IR-ADS-1 | M | AdMob SDK interface stays as today (`react-native-google-mobile-ads` via `src/utils/mobileAds.ts`); this SRS adds no new ad SDK. |
| IR-ADS-2 | M | New backend endpoint(s) per FR-ADS-14: JSON over HTTPS, Clerk-authenticated, `Cache-Control: private, no-store`, error codes `unauthenticated` (401) consistent with `/api/me`. |
| IR-ADS-3 | M | Admin `manage_users` extension (`set_ad_free`) and `manage_app_config` extension (`flags.adsEnabled`) SHALL follow existing tool shapes (validated booleans, `NotFoundError`/`ValidationError` semantics, audit entries). |

### 3.6 Constraints

| ID | Priority | Requirement |
|---|---|---|
| CR-ADS-1 | M | AdMob policies and Play policies constrain frequency, placement, and refresh behavior; FR-ADS-7/FR-ADS-4 encode the compliant floor. |
| CR-ADS-2 | M | Native-module availability constrains where ads can ever appear: Expo Go and web builds cannot show paid ads regardless of entitlement or kill switch. |
| CR-ADS-3 | M | This SRS does not change house ads or web AdSense. The `adFree` flag MUST be named and documented so a later SRS can reuse it for those surfaces without renaming. |

### 3.7 Open decisions (TBD)

| ID | Question | Recommendation |
|---|---|---|
| TBD-1 | Index `User.adFree`? | Yes if admin/support lists filter by it; otherwise a sparse index or none. Decide with backend owner at implementation. |
| TBD-2 | New `GET /api/me/ads` vs extending `GET /api/me/settings` (or summary)? | Recommend a dedicated tiny endpoint: keeps settings-sync semantics untouched and avoids widening a synced payload. |
| TBD-3 | Must entitlement resolve before first ad can show after sign-in? | Recommend no blocking: fetch in background; first screens may show an ad once for a newly ad-free account until the fetch lands (fail-open). Acceptable and simple. |
| TBD-4 | Entitlement cache TTL and refresh triggers? | Recommend: refresh on sign-in, app foreground (≥10 min throttle), and after each successful account sync; no fixed TTL beyond that. |
| TBD-5 | Play Data Safety update needed? | Recommend review: `adFree` is account data already covered by sync disclosure in most cases, but confirm with the release owner before shipping. |
| TBD-6 | Reuse `isBeta` instead of a new flag? | Rejected in scoping (2026-10-11): beta membership and ad-free are independent axes; conflating them would hide ads from testers unintentionally and block non-beta ad-free grants. Recorded here so it is not re-litigated. |

---

## 4. Traceability

### 4.1 As-built behavior → code

| Requirement | Source file(s) |
|---|---|
| FR-ADS-1 (banner screens) | `src/screens/AllSubjectsScreen.tsx`, `SubjectListScreen.tsx`, `SubjectDetailScreen.tsx`, `QuestionListScreen.tsx`, `QuestionDetailScreen.tsx`, `TopicNotesScreen.tsx` (each renders `<AdBanner />`) |
| FR-ADS-2/3/4 (banner behavior) | `src/components/AdBanner.tsx`, `src/config/ads.ts`, `src/utils/mobileAds.ts`, `src/utils/responsive.ts` (tablet detection) |
| FR-ADS-5 (init) | `App.tsx` (`mobileAds().initialize()` → `initInterstitial()`), `src/utils/ads.ts` |
| FR-ADS-6/7/8 (interstitial) | `src/utils/ads.ts`, `src/screens/QuestionDetailScreen.tsx` (~L132), `src/screens/SyllabusOverviewScreen.tsx` (~L68), `src/db/storageRegistry.ts` (counter keys) |
| FR-ADS-9 (SDK access rule) | `src/utils/mobileAds.ts` + grep for `react-native-google-mobile-ads` imports |

### 4.2 New behavior → planned code

| Requirement | Planned change |
|---|---|
| FR-ADS-10 (kill switch) | Server: `server/models/AppConfig.js`, `server/services/appConfigService.js` (`FLAG_NAMES`, defaults, validation); admin `manage_app_config` tool + app-config screen |
| FR-ADS-11 (client kill switch) | Expo: `src/config/appConfig.ts` + `useAppConfig`, gating in `AdBanner` and `src/utils/ads.ts` |
| FR-ADS-13/14 (flag + endpoint) | Server: `server/models/User.js`, `server/routes/meRoutes.js` (+ service), `Cache-Control: private, no-store` |
| FR-ADS-15 (admin set/unset) | Server: `server/services/userAdminService.js` (+ `find`/`get` projections), admin `manage_users` tool, `adminAuditService` entry |
| FR-ADS-16/17/18/19 (client gating) | Expo: new entitlement hook/store (e.g. `src/utils/adsEntitlement.ts`), `AdBanner` gate, `recordContentOpened…` gate, sign-in/out wiring in `App.tsx`, `storageRegistry.ts` key registration |
| FR-ADS-20 (settings row) | Expo: `src/screens/SettingsScreen.tsx` |
| FR-ADS-21 (counts) | Server: `server/services/insightsService.js` + `admin_app_insights` tool |

---

## 5. Acceptance criteria (suggested)

1. Release build, standard signed-in account, kill switch on: banners render on the six FR-ADS-1 screens; interstitial appears within the §2.5 budget on question/semester opens.
2. Same build, account marked ad-free: no banner space reserved on any screen; 20+ rapid content opens produce zero interstitials and zero AdMob requests (verified via request logging / Charles / SDK logs).
3. Kill switch off: ad-free and standard accounts alike see zero ads; content-open counter does not advance.
4. Offline with unknown entitlement: ads show (fail-open), no error UI, no navigation delay.
5. Sign-out after ad-free session: no ad-free residue; next signed-out launch shows ads.
6. Admin flows: set/unset ad-free round-trips, appears in `find`/`get`, every write audited; unknown account returns not-found, missing value returns validation error.
7. Regression: Expo Go / web builds show no ads and log no ad errors; `tsc --noEmit` clean; existing interstitial storage tests pass.
