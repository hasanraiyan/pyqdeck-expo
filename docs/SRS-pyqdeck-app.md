# Software Requirements Specification (SRS): PyQdeck Mobile App

Structured after IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications).

| Field | Value |
|---|---|
| Product | PyQdeck mobile app (`pyqdeck-expo`) |
| Version of product | 1.2.1 (`package.json`) |
| Document version | 1.0 (draft) |
| Date | 2026-10-10 |
| Status | Draft, reverse-engineered from the codebase; requires stakeholder review |
| Audience | Product owner, developers, QA, reviewers |

Requirement IDs: `FR-` functional, `NFR-` non-functional, `IR-` interface, `CR-` constraint. Priority uses MoSCOW (M = must, S = should, C = could). Items marked **TBD** need a decision or a measurement.

---

## 1. Introduction

### 1.1 Purpose
This SRS defines what the PyQdeck mobile app must do. It is the reference for development, testing, and acceptance of the app as shipped in version 1.2.1 and for the features that follow from it.

### 1.2 Scope
PyQdeck is a study companion for students of BEU (Bihar Engineering University) who prepare for exams. The app provides:

- Browsing of previous-year question papers (PYQs) by semester, subject, and year, with worked solutions.
- A syllabus ("Study") section with branches, semesters, subjects, modules, topics, and topic study notes, plus device-local progress tracking.
- Search across questions, notes, and subjects, with an AI overview of results.
- Community signals on solutions and notes (votes, reports) that require an account.
- Optional sign-in through Clerk.
- Push notifications, deep links, in-app updates, and review prompts.

Out of scope for this SRS: the backend API and its database (documented elsewhere), the marketing website (`pyqdeck.in`), and the AI engines that "Ask AI" links to. The app does not run AI itself.

### 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
|---|---|
| PYQ | Previous-year question paper |
| Subject | A university course (e.g. a subject in a semester) |
| Solution | A worked answer to a question, stored by the backend |
| Topic | A unit of a subject's syllabus, with optional study notes |
| Branch | An engineering discipline (e.g. CSE) that owns semesters |
| Semester | A numbered academic term within a branch |
| Ask AI | Feature that opens an external AI assistant with the question pre-filled |
| AI overview | Short AI-generated summary shown above search results (backend-generated) |
| Guard / pending action | Mechanism that parks a signed-out user's action, asks for sign-in, then replays the action |
| Read-through cache | Data is served from local storage first and refreshed from the network |
| Feature flag | Compile-time constant in `src/config/features.ts` |
| EAS | Expo Application Services. Not used for this project. |
| OTA | Over-the-air update |

### 1.4 References
- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications.
- `AGENTS.md`: Expo SDK 57 and build rules (no `eas build`; release via GitHub Actions `release.yml`).
- `docs/SRS-*.md`: feature-level SRS documents (cache layer, Mermaid diagrams, reading layout, responsive UI, search resume, solution cache collision fix).
- `docs/client-abuse-handling-plan.md`, `docs/ai-citation-back-navigation.md`.
- `CHANGELOG.md`.

### 1.5 Overview
Section 2 describes the product context, user classes, and constraints. Section 3 lists the requirements. Section 4 is a traceability table.

---

## 2. Overall description

### 2.1 Product perspective
PyQdeck is a standalone client application. It has three runtime dependencies:

1. **PyQdeck backend API**, which serves catalogue, question, solution, syllabus, notes, search, and AI-overview data. The app selects between a primary host (EC2) and a fallback host (Render) and rechecks the primary when the app returns to the foreground.
2. **Clerk**, which handles accounts and session tokens.
3. **Platform services**: Expo push notifications, Google Play in-app updates and store review, Google AdMob, Firebase Analytics, and Sentry for crash reporting.

The app is also served as a web build (react-native-web) that is used as a layout preview of the Android app. It is not a supported public web product.

### 2.2 Product functions (summary)
1. First-run onboarding tour.
2. Browse PYQs: semester, subject, year, question, solution.
3. Read solutions with rich content (Markdown, math, diagrams, code, media).
4. Study section: branches, semesters, subjects, modules, topics, notes, progress.
5. Search: questions, notes, subjects, AI overview, similar and repeated questions.
6. Community: vote on solutions and notes, report solutions and notes.
7. Account: sign-in, sign-out, account management.
8. Ask AI: hand off a question to an external AI assistant.
9. Settings: preferences, cache management, support links.
10. Notifications and deep links.
11. Updates and review prompts.

### 2.3 User classes and characteristics

| User class | Description | Frequency | Technical skill |
|---|---|---|---|
| Student (signed out) | Browses, studies, and searches without an account. Majority of users. | Daily during exam periods | Low to medium |
| Student (signed in) | Also votes and reports. | Regular | Low to medium |
| Administrator | Manages content through separate admin tooling (not in this app). | Occasional | High |
| Developer / maintainer | Builds and releases the app. | Per release | High |

### 2.4 Operating environment
- **Android** (primary): Expo SDK 57, React Native 0.86, released as AAB and APK through GitHub Actions. Minimum Android version: **TBD**.
- **iOS**: buildable with `expo run:ios`. No store release process is documented. **TBD**.
- **Web**: react-native-web build for layout preview. Not a supported release target.
- Network: the app must work with intermittent connectivity (see NFR-3).

### 2.5 Design and implementation constraints
- CR-1: The project does not use EAS Build or EAS Submit. Android releases come from `.github/workflows/release.yml` (manual dispatch with `build_type` = `aab` | `apk` | `both`).
- CR-2: Native configuration (Gradle, ProGuard, Info.plist) goes through `expo-build-properties` in `app.json`. Hand-written native files are avoided. Custom native work is limited to config plugins under `plugins/`.
- CR-3: Use official Expo packages before adding native code.
- CR-4: Clerk publishable key comes from `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` or `app.json` `expo.extra.clerkPublishableKey`. No secret keys ship in the client.
- CR-5: The app is TypeScript (`~6.0`) with React 19.2.
- CR-6: R8 minification is currently disabled because of a crash in Clerk on Android (see project memory). Re-enabling needs the keep-rules workaround first.

### 2.6 Assumptions and dependencies
Confirmed true by the product owner on 2026-10-10.

- A1 (confirmed): The backend API contract is stable for the endpoints listed in IR-5 (section 3.13.2).
- A2 (confirmed): Subject and question data are published by administrators through the admin tooling.
- A3 (confirmed): The Clerk instance and its sign-in methods are configured outside this repository.
- A4 (confirmed): Students have a Google Play account for installation on Android.
- A5 (confirmed): `pyqdeck.in` serves `/.well-known/assetlinks.json` so Android App Links verify.
all 
---

## 3. Specific requirements

### 3.1 Onboarding and first run

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | On first launch the app MUST show a 3-slide onboarding tour: browse by semester, Jump Back In, search. | M |
| FR-2 | The app MUST record completion so the tour is not shown again on later launches. | M |
| FR-3 | Settings MUST allow replaying the tour. | S |
| FR-4 | Push-permission prompt, store-update prompt, and review prompt MUST NOT be shown until onboarding is complete. | M |
| FR-5 | Onboarding MUST render as a centred column on wide windows. | S |

### 3.2 Navigation and shell

| ID | Requirement | Priority |
|---|---|---|
| FR-6 | The app MUST provide three top-level sections: PYQ (Browse), Study (Syllabus), and Search. Study MAY be hidden by feature flag `isSyllabusEnabled`. | M |
| FR-7 | On phones the sections MUST appear in a bottom tab bar. On tablets an icon rail; on laptop-width windows a labelled sidebar. | M |
| FR-8 | On laptop-width windows the sidebar MUST be collapsible, and its state MUST persist across launches. | S |
| FR-9 | The tab bar MUST be hidden on detail screens and shown on root screens (Home, Study root, Search root). | M |
| FR-10 | Auth screens (sign-in, account management, onboarding replay) MUST be presented full-screen above the tabs. | M |
| FR-11 | Deep links on `pyqdeck.in` MUST open: `/:semester/:subject/:year/:questionId` (question), `/syllabus[?branch=]`, `/syllabus/:branch/sem/:semester`, `/syllabus/subject/:slug`, `/syllabus/subject/:slug/topic/:topicId[/:slug]`, and `/search?q=&tab=`. Any other URL MUST open Home. | M |
| FR-12 | On web, `Escape` MUST go back when no dialog or text input has focus. `/` or Ctrl/Cmd+K MUST open Search when not typing. | S |
| FR-13 | Android hardware volume keys MAY scroll questions and notes when the setting is on. | C |

### 3.3 Browse previous-year papers (PYQ)

| ID | Requirement | Priority |
|---|---|---|
| FR-14 | The Home screen MUST show the brand header, a search entry point, and access to All Subjects and Settings. | M |
| FR-15 | The Home screen MUST show "Jump Back In": the most recently studied subject, paper, or topic note, with a resume action. | M |
| FR-16 | The app MUST list semesters, then subjects in a semester, then question papers by subject, with year and chapter filters. | M |
| FR-17 | The question list MUST support a filter sheet ("Filter questions"). | S |
| FR-18 | The question list MUST offer two reading layouts (classic card and a newer layout). The user MUST be prompted once to choose. The choice MUST persist. | S |
| FR-19 | The question detail screen MUST display the question text, its metadata, and its worked solution. | M |
| FR-20 | A solution MUST render: Markdown, inline and block LaTeX, Mermaid diagrams, code blocks with syntax highlighting and tabs, collapsible details blocks, callouts, tables, image galleries with zoom, embedded YouTube cards, and FAQ accordions. | M |
| FR-21 | The solution MUST support a step-by-step view (step stepper) with previous and next controls, when the content defines steps. | S |
| FR-22 | The user MUST be able to hide and show the solution. | M |
| FR-23 | The question MUST be shareable as text and copyable. | S |
| FR-24 | The solution MUST offer "Search question on Google". | S |
| FR-25 | The question detail screen MUST show similar questions on demand and repeated questions (where the backend provides them). | S |
| FR-26 | The user MUST be able to move to the previous and next question from the detail screen. | S |
| FR-27 | Each question detail MUST offer "Ask AI" (see 3.7). | M |
| FR-28 | Images in solutions MUST have a copy-URL action and a retry action when loading fails. | S |
| FR-29 | Diagrams MUST open in a full-screen viewer with a copy-source action. | S |

### 3.4 Study (Syllabus)

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | The Study root MUST let the user pick a branch and a semester. A shared link with `?branch=` MUST pre-select the branch. | M |
| FR-31 | The semester overview MUST show subjects in two groups, theory and labs, as a table of subject against progress (topics completed). | M |
| FR-32 | The subject syllabus MUST show modules that expand and collapse, each containing topics. | M |
| FR-33 | A topic MUST have a tick control that marks it done. Tapping the topic title MUST also toggle it (large hit target). | M |
| FR-34 | Topic progress MUST be stored on the device only, per subject, and MUST NOT require an account or leave the device. | M |
| FR-35 | A topic with notes MUST show a notes control that opens the topic notes screen. | M |
| FR-36 | Topic notes MUST render the same rich content as solutions (FR-20), including an FAQ section when present. | M |
| FR-37 | The topic notes screen MUST support volume-key scrolling (when enabled, FR-13). | C |
| FR-38 | The semester overview MUST offer an interstitial ad at most once per open, subject to a shared frequency cap. | S |

### 3.5 Search

| ID | Requirement | Priority |
|---|---|---|
| FR-39 | The Search screen MUST provide tabs: All, Questions, Notes, Subjects. The active tab MUST be settable from a deep link (`tab=`). | M |
| FR-40 | Search MUST return question, note, and subject results from the backend. | M |
| FR-41 | Search MUST show an AI overview card above results when the backend reports the feature as enabled. The card MUST be collapsed by default and MUST show a loading state while generating. | S |
| FR-42 | Each AI overview citation MUST link to the source question or note. | S |
| FR-43 | When the device is offline or the backend is unreachable, search MUST fall back to items already cached on the device and say so. | M |
| FR-44 | Search MUST enforce client-side rate limiting: burst of 5 requests, then 1 request every 2 seconds. A rate-limited request MUST show a visible message, not a silent offline fallback. | M |
| FR-45 | Search MUST resume the last query and tab when the user returns to it. | S |
| FR-46 | Search MUST NOT run on queries shorter than the minimum length **TBD**. | S |

### 3.6 Community: votes, reports, and sign-in

| ID | Requirement | Priority |
|---|---|---|
| FR-47 | The user MUST be able to upvote or downvote a solution, retract a vote, or switch a vote. | M |
| FR-48 | A vote MUST update the displayed counts immediately (optimistic update) and reconcile with the server response. Rapid repeated taps MUST be coalesced so the last intent wins. | M |
| FR-49 | Votes on solutions and topic notes MUST highlight the user's current vote on that item after a restart. | M |
| FR-50 | Voting on a solution or notes MUST require sign-in. A signed-out user who taps vote MUST be sent to sign-in, and the vote MUST be applied after sign-in completes. A pending action MUST run at most once. | M |
| FR-51 | The user MUST be able to report a solution. Report reasons and messages are defined by the backend. | M |
| FR-52 | The user MUST be able to report topic notes with one of five reasons: incorrect information, incomplete notes, outdated or not in syllabus, offensive or inappropriate, other. An optional message of free text MAY be added. | M |
| FR-53 | A user who has already reported the same notes MUST see a message saying so, not an error. | S |
| FR-54 | Reporting and voting MUST NOT be available to a signed-out user, except through the sign-in flow in FR-50. | M |
| FR-55 | Browsing, Study, Search, and reading solutions MUST work fully without an account. | M |

### 3.7 Ask AI

| ID | Requirement | Priority |
|---|---|---|
| FR-56 | "Ask AI" MUST let the user pick an engine and open it with the question pre-filled. Engines: Coursify, ChatGPT, Claude, Perplexity, Grok, Copilot, Google AI Mode. | M |
| FR-57 | The app MUST NOT send the question through PyQdeck's own servers for Ask AI. The question is sent only to the chosen external engine. | M |
| FR-58 | For engines that may ignore pre-filled text, the app MUST copy the question to the clipboard so the user can paste it. | M |
| FR-59 | Ask AI MUST be hidden when feature flag `isAiEnabled` is false. | M |

### 3.8 Settings and account

| ID | Requirement | Priority |
|---|---|---|
| FR-60 | Settings MUST show the signed-in user's name or email, with sign-out. When signed out it MUST show a sign-in entry. | M |
| FR-61 | Settings MUST include: Ask AI engine choice, volume-key scrolling toggle, clear cached data, replay tour, Diagram Preview, rate app, share app, check for updates, website, privacy policy, about. | M |
| FR-62 | Clear cached data MUST ask for confirmation before clearing the local cache. Synced progress and preferences MUST NOT be erased by this action **TBD** (confirm which local stores are included). | M |
| FR-63 | Account management MUST be available from a dedicated screen opened from Settings. | M |
| FR-64 | Sign-in MUST use Clerk and MUST NOT hold up first paint: the app MUST render signed out while the session loads. | M |

### 3.9 Notifications, updates, and feedback

| ID | Requirement | Priority |
|---|---|---|
| FR-65 | The app MUST request push-notification permission after onboarding and register the device's Expo push token with the backend. | S |
| FR-66 | Tapping a notification with `subjectId` and `questionId` MUST open that question, including from a cold start. | S |
| FR-67 | Notifications MUST display while the app is in the foreground. | S |
| FR-68 | On Android the app MUST check for a store update and offer an in-app update when one is available. | S |
| FR-69 | The app MUST prompt for a store review at most once in a period and never back-to-back with an update prompt. The exact interval is **TBD**. | C |
| FR-70 | Rate and share actions MUST be available in Settings. | S |

### 3.10 Advertising

| ID | Requirement | Priority |
|---|---|---|
| FR-71 | The app MUST show banner ads and an interstitial ad through Google AdMob. | M |
| FR-72 | Development and debug builds MUST use test ad units. Only release builds MAY serve production ad units. | M |
| FR-73 | Ads MUST NOT appear on the sign-in or onboarding screens **TBD** (confirm). | S |

### 3.11 Content rendering

| ID | Requirement | Priority |
|---|---|---|
| FR-74 | Math MUST render with LaTeX syntax (inline `$...$` and block `$$...$$`). | M |
| FR-75 | Mermaid diagrams MUST render from fenced `mermaid` blocks. Rendering MUST happen off the main thread where supported. | M |
| FR-76 | Content that fails to render MUST show a fallback and MUST NOT crash the screen. The content error boundary MUST contain the failure to that content block. | M |
| FR-77 | Callouts, details blocks, code tabs, and image galleries MUST be parsed from the same Markdown source used for solutions and notes. | M |

---

### 3.12 Non-functional requirements

#### 3.12.1 Performance

| ID | Requirement | Priority |
|---|---|---|
| NFR-1 | Cold start to first rendered screen: **TBD** target (proposed ≤ 2.5 s on a mid-range Android device). | S |
| NFR-2 | Question list and detail screens MUST render from cache within one frame when the data is cached. Network refresh MUST NOT block the first paint. | M |
| NFR-3 | The app MUST remain usable offline for previously viewed questions, notes, and subjects (served from the persisted cache). | M |
| NFR-4 | A cached response MUST be served while a fresh one loads. Freshness windows are **TBD** per data type (see `docs/SRS-unified-cache-layer.md`). | M |

#### 3.12.2 Reliability and availability

| ID | Requirement | Priority |
|---|---|---|
| NFR-5 | If the primary backend host fails, the app MUST switch to the fallback host without user action, and recheck the primary after returning to the foreground. | M |
| NFR-6 | Vote and report requests that fail MUST roll back the optimistic change and show an error. | M |
| NFR-7 | Crash and error reports MUST be sent to Sentry. Sentry MUST NOT send IP addresses, default PII, or session replays. | M |
| NFR-8 | Availability target for the backend: **TBD**. | — |

#### 3.12.3 Security and privacy

| ID | Requirement | Priority |
|---|---|---|
| NFR-9 | The client MUST NOT contain secret keys. Only the Clerk publishable key and ad and analytics identifiers are present. | M |
| NFR-10 | Authentication tokens MUST be stored through Clerk's token cache. | M |
| NFR-11 | Progress and preferences MUST stay on the device. Only votes, reports, search queries, and push tokens are sent to the backend. | M |
| NFR-12 | Client-side search rate limiting (FR-44) MUST be applied in addition to any server-side limits. | M |
| NFR-13 | The app MUST carry a privacy policy link (`/privacy`) and disclose its data collection in the Google Play Data Safety form **TBD** (confirm the form matches the Firebase and AdMob usage). | M |
| NFR-14 | Pending actions (FR-50) MUST NOT persist across app restarts **TBD** (confirm current behaviour). | S |

#### 3.12.4 Usability and accessibility

| ID | Requirement | Priority |
|---|---|---|
| NFR-15 | Interactive controls MUST have accessibility labels describing their action (for example "Show solution", "Mark topic as done", "Helpful notes"). | M |
| NFR-16 | Text in the tab bar MUST NOT scale with the system font size, so that the bar keeps a fixed size. | M |
| NFR-17 | Layouts MUST adapt to phone, tablet, and laptop-width windows (see `docs/SRS-responsive-ui-migration.md`). | M |
| NFR-18 | The app MUST support the dark and light palettes defined in `src/theme/colors.ts` **TBD** (confirm whether the app follows the system theme). | S |
| NFR-19 | Text contrast MUST meet WCAG 2.1 AA **TBD** (not yet audited). | S |

#### 3.12.5 Maintainability

| ID | Requirement | Priority |
|---|---|---|
| NFR-20 | Feature flags (`isSyllabusEnabled`, `isAuthEnabled`, `isAiEnabled`) MUST gate their features without deleting code. | M |
| NFR-21 | Pure logic (layout math, parsers, storage helpers) MUST have unit tests run by `npm test`. | S |
| NFR-22 | Release builds MUST be produced by the GitHub Actions workflow and MUST bump `expo.android.versionCode` in `app.json` (CR-1). | M |

#### 3.12.6 Compatibility

| ID | Requirement | Priority |
|---|---|---|
| NFR-23 | Deep links MUST work whether or not the app is installed (web fallback on `pyqdeck.in`). | M |
| NFR-24 | The app MUST keep the URL structure of `pyqdeck-frontend` so shared links resolve in both. | M |

---

### 3.13 External interface requirements

#### 3.13.1 User interfaces
- IR-1: Mobile-first layout with a bottom tab bar on phones, an icon rail on tablets, and a labelled sidebar on laptop-width windows (FR-7).
- IR-2: Icons from `@expo/vector-icons` (Feather set).
- IR-3: Typography: Plus Jakarta Sans (display) and Inter (body), loaded through `@expo-google-fonts`.
- IR-4: Native stack headers with the app background and Plus Jakarta Sans bold titles.

#### 3.13.2 Software interfaces

| ID | Interface | Purpose |
|---|---|---|
| IR-5 | PyQdeck backend REST API (primary and fallback hosts) | Catalogue, questions, solutions, syllabus, notes, search, AI overview, votes, reports, push-token registration |
| IR-6 | Clerk | Sign-in, session, user profile |
| IR-7 | Expo Notifications | Push token and notification handling |
| IR-8 | Google Play In-App Updates and Store Review | Update check, review prompt |
| IR-9 | Google AdMob | Banner and interstitial ads |
| IR-10 | Firebase Analytics | Screen views and events (e.g. `vote_solution`) |
| IR-11 | Sentry | Crash and error reporting |
| IR-12 | External AI engines (URL hand-off) | Ask AI pre-filled links |
| IR-13 | YouTube | Embedded player and search links |
| IR-14 | AsyncStorage and the persisted React Query cache | Local storage |

#### 3.13.3 Hardware interfaces
- IR-15: Touch screen (primary); hardware volume keys (optional scroll).
- IR-16: Haptic feedback via `expo-haptics` **TBD** (confirm where it is used).

#### 3.13.4 Communications interfaces
- IR-17: HTTPS only for backend, Clerk, and external links.

---

### 3.14 Data requirements

| ID | Requirement | Priority |
|---|---|---|
| DR-1 | Local persisted data MUST include: query cache, my-vote highlights (per subject and question), syllabus progress (per subject), recent-study history, onboarding flag, sidebar state, layout choice, Ask AI engine choice, volume-scroll setting. | M |
| DR-2 | The local cache MUST be keyed by subject where the same question id can repeat across subjects. | M |
| DR-3 | Recent-study history MUST keep the last items studied, to power Jump Back In. The maximum count is **TBD**. | S |
| DR-4 | Syllabus progress MUST be stored per subject so that one tick rewrites a small value. | S |
| DR-5 | A legacy cache format MUST be migrated on first launch, with the legacy keys removed only after the new data is written. | M |

---

## 4. Traceability

| Feature area | Requirements | Source files |
|---|---|---|
| Onboarding | FR-1 to FR-5 | `OnboardingScreen.tsx`, `utils/onboarding.ts` |
| Navigation and shell | FR-6 to FR-13 | `App.tsx`, `components/ShellTabBar.tsx`, `utils/responsive.ts`, `theme/layout.ts` |
| Browse PYQ | FR-14 to FR-29 | `HomeScreen.tsx`, `QuestionListScreen.tsx`, `QuestionDetailScreen.tsx`, `components/QuestionItem*.tsx`, `utils/recentStudy.ts` |
| Rich content | FR-20, FR-74 to FR-77 | `components/NativeContentRenderer.tsx`, `MermaidBlock.tsx`, `MathView.tsx`, `utils/*Parser.ts` |
| Study | FR-30 to FR-38 | `SemesterSelectScreen.tsx`, `SyllabusOverviewScreen.tsx`, `SubjectSyllabusScreen.tsx`, `TopicNotesScreen.tsx`, `db/syllabusProgress.ts` |
| Search | FR-39 to FR-46 | `SearchScreen.tsx`, `utils/searchGuard.ts`, `api/offlineSearch.ts`, `components/AiOverviewCard.tsx` |
| Votes and reports | FR-47 to FR-55 | `QuestionDetailScreen.tsx`, `components/NoteFeedbackBar.tsx`, `utils/votes.ts`, `auth/useRequireAuth.ts`, `auth/pendingAction.ts` |
| Ask AI | FR-56 to FR-59 | `utils/askAi.ts`, `config/features.ts` |
| Settings and account | FR-60 to FR-64 | `SettingsScreen.tsx`, `ManageAccountScreen.tsx`, `SignInScreen.tsx`, `utils/settings.ts` |
| Notifications and updates | FR-65 to FR-70 | `utils/notifications.ts`, `utils/appUpdate.ts`, `utils/appReview.ts` |
| Ads | FR-71 to FR-73 | `config/ads.ts`, `utils/ads.ts`, `utils/mobileAds.ts`, `components/AdBanner.tsx` |
| Backend and cache | NFR-3 to NFR-5, DR-1 to DR-5 | `api/*.ts`, `api/backend.ts`, `db/cacheService.ts` |
| Release | NFR-22, CR-1, CR-2 | `.github/workflows/release.yml`, `app.json` |

---

## 5. Open questions (TBD register)

| # | Question | Owner |
|---|---|---|
| 1 | Minimum supported Android and iOS versions. | Product |
| 2 | Performance targets (NFR-1) and backend availability (NFR-8). | Engineering |
| 3 | Minimum search query length (FR-46). | Product |
| 4 | Review-prompt interval (FR-69). | Product |
| 5 | Whether ads appear on sign-in and onboarding (FR-73). | Product |
| 6 | Which local stores "Clear cached data" removes (FR-62). | Engineering |
| 7 | Whether pending actions survive an app restart (NFR-14). | Engineering |
| 8 | Dark-mode support and WCAG audit (NFR-18, NFR-19). | Design |
| 9 | Data Safety form contents vs. Firebase and AdMob usage (NFR-13). | Product |
| 10 | Maximum recent-study items (DR-3). | Engineering |
| 11 | Where haptics are used (IR-16). | Design |
| 12 | Re-enabling R8 after the Clerk crash fix (CR-6). | Engineering |

---

## 6. Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 (draft) | 2026-10-10 | Reverse-engineered from the codebase | Initial IEEE 830-style SRS for app version 1.2.1 |
| 1.0 (draft, rev A) | 2026-10-10 | Product owner | Assumptions A1 to A5 confirmed true; A1 cross-reference corrected to IR-5 |
