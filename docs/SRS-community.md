# Software Requirements Specification (SRS): PYQDeck Community

Structured after IEEE Std 830-1998 (Recommended Practice for Software Requirements Specifications), following the conventions of `docs/SRS-pyqdeck-app.md` and feature-level SRS documents in this repository.

| Field | Value |
|---|---|
| Product | PYQDeck Community — Website, Expo app, and shared backend |
| Document version | 1.0 (draft) |
| Date | 2026-10-17 |
| Status | Draft; proposed requirements, needs product and engineering review |
| Audience | Product owner, website developers, mobile developers, backend developers, QA, moderation reviewers |
| Primary repositories | `hasanraiyan/pyqdeck-expo`; website and server repositories to be confirmed |

Requirement IDs: `FR-COM-` functional, `NFR-COM-` non-functional, `IR-COM-` interface, `CR-COM-` constraint, `DR-COM-` data. Priority uses MoSCoW (M = must, S = should, C = could). **Proposed API routes in this document are contracts to implement/verify, not claims that they already exist.**

---

## 1. Introduction

### 1.1 Purpose

This SRS defines a shared PYQDeck Community where students can publish and discover study notes, handwritten images, PDF resources, questions/doubts, worked PYQ solutions, and short study tips. It specifies the website experience, the Expo application experience, common server behaviour, academic personalization, link sharing and deep linking, and moderation of uploaded content.

This document is the development, QA, and acceptance reference for the Community feature.

### 1.2 Scope

In scope:

- Public web feed, subject-aware notes library, post detail pages, search, filters, and public shareable URLs.
- Community screens in the Expo app, reusing existing account, catalogue, content rendering, and contribution patterns where applicable.
- Post types: notes, doubts, PYQ solutions linked to an existing question where possible, and study tips.
- Attachments: images and PDF documents, subject to configured file limits.
- Academic profile and structured academic tags for university/curriculum, college (optional), branch, semester, subject, module, and topic.
- Feed ranking and filtering to help the right resources reach the right students.
- Comments on doubt/post threads, reactions or helpful votes, bookmarks, reporting, and creator profile/contribution views.
- Canonical web URLs, share sheet/copy-link, Android App Links, iOS Universal Links, and app/web fallback behaviour.
- Private/quarantined uploads, automated safety inspection, a moderation queue, publication states, and auditability.
- Administrative controls for reviewing, removing, and escalating prohibited content.

Out of scope for the first release:

- Real-time chat, group messaging, voice/video calls, followers-based social feed, or creator monetization.
- Public direct messages between students.
- Automatically generating study answers using AI. OCR, AI summaries, semantic search, and recommendations beyond deterministic academic matching are optional later improvements.
- Replacing the existing PYQ catalogue, syllabus management, or admin publishing system.
- Guaranteeing that user-posted academic material is correct; feedback and reports are provided for quality control.

### 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
|---|---|
| Community post | User-created resource or discussion record with academic context and publication status |
| Canonical URL | Stable HTTPS URL that identifies one public resource |
| Deep link | URL that routes to the matching screen in the installed app |
| App Link / Universal Link | Verified HTTPS link association for Android / iOS |
| Academic context | University/curriculum, branch, semester, subject, module, and topic tags |
| Quarantine | Private storage and/or processing state where an upload is not publicly accessible |
| Moderation | Automated and/or human review for safety and policy compliance |
| Published | Post is approved and can be displayed in public feed/search/detail pages |
| PYQ | Previous-year question paper or question |
| Clerk | Existing identity and session provider in the Expo app |
| MoSCoW | Must, Should, Could, Won't (this release) priority scheme |

### 1.4 References

- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications.
- `docs/SRS-pyqdeck-app.md` — mobile app requirements, navigation, auth, search, and deep links.
- `docs/SRS-user-paper-contributions.md` — existing contribution/upload patterns and storage concepts.
- Existing Expo auth, pending-action, backend API, and URL/deep-link utilities.
- Website routing/SEO conventions and server API documentation (repository paths to be confirmed).
- Applicable platform policies, privacy policy, and community safety rules (legal/product review required).

### 1.5 Overview

Section 2 describes product context, user classes, environment, and constraints. Section 3 defines functional, non-functional, interface, and data requirements. Section 4 gives traceability. Section 5 lists unresolved decisions.

---

## 2. Overall description

### 2.1 Product perspective

PYQDeck Community is one feature implemented across three surfaces:

1. **Website**: the primary public and shareable representation. Public published posts are accessible at canonical HTTPS URLs and can be indexed where permitted.
2. **Expo app**: a native-friendly Community feed, create-post flow, post details, notes viewer, discussion interactions, and deep-link destinations.
3. **Shared backend and storage**: the system of record for posts, academic references, comments, reactions, bookmarks, reports, moderation state, and shareable identifiers.

Website and app MUST use the same backend records and publication rules. The web page is not a separate copy of a post, and the app must not create a competing canonical identifier. The web URL is the cross-platform share target; verified HTTPS links open the corresponding app screen when installed and otherwise render the web page.

Existing PYQ, syllabus, subject, module, topic, and question records SHOULD be referenced by IDs wherever available rather than duplicated into Community-owned catalogues.

### 2.2 Product functions (summary)

1. Browse published posts without signing in.
2. Personalize feed after optional academic profile setup.
3. Search and filter notes by university/curriculum, branch, semester, subject, module, topic, and post type.
4. Create, edit (own posts), and delete/withdraw eligible community posts.
5. Upload multiple images and/or PDFs under configurable safety and size limits.
6. Ask doubts and discuss them through comments.
7. Link a post to an existing PYQ question, subject, or syllabus topic.
8. React/helpful-vote, bookmark, share, copy link, and report.
9. View author profile and published contributions.
10. Resolve canonical links to web or Expo app, including cold starts and logged-out sessions.
11. Inspect uploads, queue uncertain content, reject prohibited content, and remove content after publication.
12. Provide rate limits, abuse prevention, audit trails, and basic operational analytics.

### 2.3 User classes and characteristics

| User class | Capabilities | Authentication |
|---|---|---|
| Guest visitor | Browse public feed, read published posts, search, filter, share URLs, view public profiles | Not required |
| Signed-in student | All guest capabilities plus create posts, comment, react/helpful-vote, bookmark, report, manage own posts/profile | Required for write actions |
| Moderator | Review reported/queued content, publish/reject/remove posts, record reasons and actions | Required; server-side moderator role |
| Administrator | Moderator capabilities plus manage moderation policy/configuration and inspect audit records | Required; server-side administrator role |
| Maintainer | Deploys and operates web, mobile, backend, and moderation integrations | Privileged operational access |

A public profile MUST expose only fields intended for public display. Private account data, email, authentication identifiers, and moderation-only data MUST NOT be returned by public profile APIs.

### 2.4 Operating environment

- **Website**: public PYQDeck website on `pyqdeck.in`; responsive desktop, tablet, and mobile browsers.
- **Expo app**: existing `pyqdeck-expo` application, with Android as the primary documented release target and iOS support subject to its current release readiness.
- **Backend**: existing PYQDeck API/service, to be inspected before route or database implementation. This SRS defines required behaviour independently of existing route names.
- **Identity**: existing Clerk authentication in the Expo client; website authentication integration MUST be confirmed and then shared/compatible with the backend's account model.
- **Storage**: private quarantine/staging storage for unreviewed uploads, plus controlled delivery of approved attachments.
- **Network**: HTTPS. Read-only public content should degrade gracefully on intermittent connections.

### 2.5 Design and implementation constraints

- CR-COM-1: Website, app, and backend MUST use one authoritative post ID and state model.
- CR-COM-2: Proposed endpoints in this SRS are not assumed to exist. Developers MUST inspect current server routes, schemas, authentication middleware, and upload pipeline before implementing or renaming routes.
- CR-COM-3: Use existing subject/question/syllabus identifiers and validators where available; never trust client-supplied academic labels or role flags as authoritative.
- CR-COM-4: All publication and moderation decisions MUST be enforced server-side.
- CR-COM-5: Unreviewed attachments MUST NOT be accessible through permanent public URLs or appear in public post responses.
- CR-COM-6: Do not expose secret keys or moderation-service credentials in website or Expo client bundles.
- CR-COM-7: Canonical share URLs MUST use HTTPS on the official domain and be stable when post titles change.
- CR-COM-8: Use Android App Links and iOS Universal Links where the app platforms are supported; preserve website fallback for every canonical URL.
- CR-COM-9: Do not implement a new user identity store solely for Community; integrate with the established authentication/account model.
- CR-COM-10: Moderation provider, thresholds, human-review operations, upload limits, and retention periods require product/engineering decisions before production launch.

### 2.6 Assumptions and dependencies

- A1: `pyqdeck.in` is the preferred canonical host for shareable Community resources.
- A2: Students may browse Community without selecting a profile or signing in; profile setup is optional and can be completed later.
- A3: Creating, commenting, reacting, bookmarking, and reporting require a signed-in user.
- A4: Website and Expo app can authenticate against compatible account identities. The exact web auth implementation is TBD.
- A5: The server can validate academic catalog references and identify moderators/admins from trusted server-side claims.
- A6: Upload inspection must complete before the content is eligible to become public.
- A7: Existing URL association for `pyqdeck.in` is referenced by the mobile SRS; the exact Android/iOS domain association configuration MUST be re-verified during implementation.
- A8: This is a proposed feature-level SRS; no proposed Community endpoint or collection is claimed to exist unless verified in the relevant codebase.

---

## 3. Specific requirements

### 3.1 Navigation and entry points

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-1 | The website MUST provide a public Community entry point at `/community`. | M |
| FR-COM-2 | The Expo app MUST provide a Community entry point using the existing navigation shell conventions. Placement (tab, rail, or secondary destination) MUST be decided during UI integration. | M |
| FR-COM-3 | The website and app MUST offer access to a Notes Library, a feed, and individual post detail pages. | M |
| FR-COM-4 | Guests MUST be able to enter, browse, search, and read Community without mandatory academic onboarding or sign-in. | M |
| FR-COM-5 | A guest MAY be prompted to set academic preferences to personalize their feed; dismissing the prompt MUST NOT block browsing. | S |
| FR-COM-6 | On small phone viewports, primary navigation and create-post actions MUST remain usable without horizontal overflow. | M |
| FR-COM-7 | Direct navigation to a valid Community URL MUST render the intended resource instead of always redirecting to Home. | M |

### 3.2 Academic profile and content classification

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-8 | A user MAY save academic preferences: university, curriculum/regulation where applicable, college (optional), branch, and current semester. | S |
| FR-COM-9 | Academic profile fields MUST be editable after setup, and users MUST be able to skip setup. | M |
| FR-COM-10 | Each post MUST declare a type: `note`, `doubt`, `pyq_solution`, or `tip`. | M |
| FR-COM-11 | Posts MUST support structured academic tags for university/curriculum, branch, semester, subject, module, and topic when relevant. | M |
| FR-COM-12 | Subject, module, topic, and linked-question references MUST be validated against the server's current catalogue where those records exist. | M |
| FR-COM-13 | The user interface MUST guide the author through dependent selections (branch/semester, subject, module, topic) and clear invalid downstream selections when a parent changes. | M |
| FR-COM-14 | The app and website MUST preserve the academic context selected on a draft during navigation and upload retries. | S |
| FR-COM-15 | A post's academic tags MUST describe the resource itself and MUST NOT be automatically rewritten when the author's current semester changes. | M |
| FR-COM-16 | The feed SHOULD rank exact matches for a user's university/curriculum, branch, semester, and subject above broader or adjacent matches, while clearly labelling the context of each resource. | S |
| FR-COM-17 | Users MUST be able to manually filter content independent of their saved profile. | M |
| FR-COM-18 | The system MUST permit catalogue-wide resources or posts with partial academic tags when a precise match is not applicable; such posts MUST be labelled and must not be misrepresented as exact matches. | S |

### 3.3 Feed, library, search, and filters

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-19 | The feed MUST display only posts whose server status is `published`. | M |
| FR-COM-20 | The feed MUST support at least `For You` (personalized or filter-based) and `Latest` ordering. Additional tabs such as `My Branch` MAY be added. | M |
| FR-COM-21 | Feed cards MUST display post type, title, author display name/avatar where public, publication time, academic tags, attachment preview where safe, and supported interaction counts. | M |
| FR-COM-22 | The Notes Library MUST support query search plus filters for post type, university/curriculum (where available), branch, semester, subject, module, and topic. | M |
| FR-COM-23 | Search and filters MUST be represented in the URL query string where practical, so filtered results can be shared and browser Back/Forward work as expected. | S |
| FR-COM-24 | The system MUST support pagination or cursor-based incremental loading; it MUST NOT require downloading the entire Community dataset. | M |
| FR-COM-25 | Empty and no-result states MUST offer a useful next action such as removing a filter or creating the first note. | S |
| FR-COM-26 | Public search results and feeds MUST exclude pending, rejected, removed, deleted, and otherwise non-public posts. | M |
| FR-COM-27 | The website SHOULD emit canonical metadata and search-engine metadata for indexable published post pages. | S |
| FR-COM-28 | The site MUST generate Open Graph/social preview metadata for shareable published post pages, including safe title, description, image, and canonical URL. | M |
| FR-COM-29 | Unpublished, private, removed, or access-restricted resources MUST NOT be advertised through public sitemap entries or social preview images. | M |

### 3.4 Create, edit, and delete posts

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-30 | The system MUST offer a create-post flow with post type selection: Share Notes, Ask a Doubt, Share PYQ Solution, or Share a Study Tip. | M |
| FR-COM-31 | A post MUST have a title and may have a text body, academic tags, attachments, and an optional link to an existing PYQ question. Per-type validation rules MUST be documented in implementation tests. | M |
| FR-COM-32 | Authors MUST be able to attach multiple images and/or PDF files, subject to configured file-count, file-size, page-count, and total-upload limits. Exact limits are TBD. | M |
| FR-COM-33 | The client MUST show upload progress, per-file errors, retry/remove controls, and a clear distinction between upload completion and publication approval. | M |
| FR-COM-34 | Authors MUST be able to save an incomplete post as a local draft. Persistent cross-device draft sync is optional for the first release. | S |
| FR-COM-35 | A signed-in author MUST be able to edit their own eligible post. Edits affecting text, academic tags, or attachments MUST trigger re-moderation before the changed version is publicly served. | M |
| FR-COM-36 | An author MUST be able to withdraw/delete their own post. The server MUST immediately remove it from public feed/search/detail results and revoke public attachment access as applicable. Audit/retention behaviour is TBD. | M |
| FR-COM-37 | The server MUST verify ownership for edits/deletes and MUST NOT rely solely on client checks. | M |
| FR-COM-38 | Repeated create requests caused by retries MUST NOT create duplicate posts when an idempotency key is supplied and supported by the API. | S |

### 3.5 Uploads and attachment handling

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-39 | Image selection MUST support the available platform photo picker; capture from camera MAY be offered where supported. | S |
| FR-COM-40 | PDF selection MUST be restricted to permitted document types by both client validation and server-side validation. | M |
| FR-COM-41 | The server MUST validate file content/signature, claimed MIME type, actual decoded format, size, count, and supported dimensions/page limits. Client filename or MIME metadata MUST NOT be trusted alone. | M |
| FR-COM-42 | New uploads MUST enter private temporary/quarantine storage or an equivalent non-public state before public approval. | M |
| FR-COM-43 | The moderation pipeline MUST inspect every image and document/page supported by configured scanners; a multi-image post MUST NOT bypass scanning because one attachment passed. | M |
| FR-COM-44 | Permanent or publicly accessible attachment URLs MUST NOT be issued to clients or public pages before the associated attachment is approved for publication. | M |
| FR-COM-45 | When an upload, file decoder, malware checker, or safety scanner fails or times out, the system MUST fail closed: the associated content remains pending/unpublished until policy permits a safe decision. | M |
| FR-COM-46 | The system MUST show clear user-facing upload states including uploading, received/pending review, published, rejected, and failed/retryable. | M |
| FR-COM-47 | The system SHOULD strip unnecessary EXIF metadata, including precise location data, from image derivatives before public delivery. | S |
| FR-COM-48 | The backend MUST throttle excessive upload and post creation, including per-account and abuse-oriented controls. | M |

### 3.6 Moderation, prohibited content, and reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-49 | A post MUST follow the status lifecycle `draft` (client-only or private), `pending`, `published`, `rejected`, and `removed`; implementation MAY add substates such as `processing` or `needs_review`. | M |
| FR-COM-50 | Automated safety classification MUST check uploaded images for sexual/nudity content and other prohibited material defined by the Community policy. Additional checks for spam, abuse, and malware SHOULD be integrated as feasible. | M |
| FR-COM-51 | The pipeline MUST route high-confidence allowed content to the next configured publication decision, uncertain content to a human review queue, and high-confidence prohibited content to rejection or restricted escalation according to policy. | M |
| FR-COM-52 | Explicit or otherwise prohibited imagery MUST NOT be published publicly. Content suspected to depict sexual abuse or exploitation of minors MUST follow a restricted safety escalation and retention process, not ordinary moderation. | M |
| FR-COM-53 | If moderation is unavailable, produces an error, or returns an inconclusive result, the upload MUST remain non-public. | M |
| FR-COM-54 | The product MUST provide a report action on posts and comments with a reason taxonomy including inappropriate/sexual content, spam, harassment, misleading/incorrect academic content, copyright concern, and other. | M |
| FR-COM-55 | A user MUST be able to report an item without being shown reporter identity to the reported author. Whether reporting requires login is TBD; recommended policy is to require sign-in for reports and rate-limit them. | S |
| FR-COM-56 | Moderators MUST be able to inspect queued and reported content, see machine decision/reason and context, publish/reject/remove an item, and record an internal reason. | M |
| FR-COM-57 | Moderator and administrator actions MUST be authorized on the server using roles/permissions not supplied by the client. | M |
| FR-COM-58 | A moderator action MUST create an audit record containing actor, item, action, timestamp, and reason, without copying prohibited imagery into ordinary logs. | M |
| FR-COM-59 | Rejected or removed content MUST be hidden from public APIs and have its public attachment access disabled or revoked. | M |
| FR-COM-60 | The system MUST support user reporting and moderator removal after publication; automated pre-publication screening does not replace post-publication reporting. | M |
| FR-COM-61 | Repeat abuse MUST be manageable through server-enforced posting limits, temporary restrictions, and account suspension/escalation where available. | S |
| FR-COM-62 | Community guidelines and an appeal/contact path for moderation decisions MUST be reachable from create-post and rejection screens. | S |

### 3.7 Comments, reactions, and bookmarks

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-63 | Signed-in users MUST be able to comment on eligible published posts; comments MUST support plain text and a configured length limit. Rich attachments in comments are optional. | M |
| FR-COM-64 | Users MUST be able to edit/delete their own comments subject to moderation and audit policy. | S |
| FR-COM-65 | The system MUST offer a simple reaction/helpful-vote interaction on eligible posts, with one effective state per user per post unless multiple reaction types are explicitly designed. | M |
| FR-COM-66 | Users MUST be able to save/bookmark a post to a personal list. Bookmark lists MUST remain private to the owner. | M |
| FR-COM-67 | Signed-out users who attempt a write action MUST be routed to authentication. After successful sign-in, the pending action MAY be replayed only if it is safe and still valid; it MUST NOT execute more than once. | M |
| FR-COM-68 | Vote, comment, bookmark, and report counts/state MUST reconcile with the backend response; UI optimistic updates MUST roll back on failure. | M |
| FR-COM-69 | Reporting, reacting, and comments MUST be rate-limited server-side to limit spam and abuse. | M |

### 3.8 PYQ and syllabus integration

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-70 | Authors MUST be able to search and attach a related existing PYQ question to a `pyq_solution` post when such a question exists. | M |
| FR-COM-71 | A post detail page MUST link to its related PYQ question, subject, syllabus module, or topic where a valid reference is present. | M |
| FR-COM-72 | Navigating from a Community post to a PYQ/syllabus item MUST use the established site/app URL format and preserve the ability to return to the post. | M |
| FR-COM-73 | The system MUST NOT copy the full authoritative syllabus or question metadata into each post; it SHOULD store stable references and resolve display labels from catalogue data. | S |

### 3.9 Canonical URLs, sharing, and deep links

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-74 | Every published post MUST have a stable canonical HTTPS URL on the official PYQDeck domain. Example pattern: `https://pyqdeck.in/community/:slug`; exact route is subject to existing website conventions. | M |
| FR-COM-75 | The stable identifier MUST remain resolvable when a title/slug changes; the backend or website MUST redirect old slugs or resolve by stable ID. | M |
| FR-COM-76 | The website and Expo app MUST display a share action that invokes the platform share sheet where available and a copy-link fallback. | M |
| FR-COM-77 | Opening a canonical post URL in a supported installed app MUST route to the exact post, including when the app is cold-started. | M |
| FR-COM-78 | When the app is not installed or cannot handle the URL, the canonical HTTPS URL MUST render the equivalent public web page. | M |
| FR-COM-79 | Android App Links and iOS Universal Links MUST be configured and verified for the production domain and required paths. | M |
| FR-COM-80 | A deep link MUST preserve valid route parameters and must not discard the target post when authentication is required for a subsequent interaction. | M |
| FR-COM-81 | A deep link for an unknown, deleted, removed, or unpublished post MUST display an appropriate not-found/unavailable state; it MUST NOT reveal private moderation information. | M |
| FR-COM-82 | URL routing MUST validate and normalize query parameters and slugs, reject unsafe schemes, and prevent open redirects. | M |
| FR-COM-83 | Public post pages MUST provide Open Graph/Twitter-compatible metadata for supported link-preview consumers. Preview images MUST be moderated and safe for public delivery. | M |
| FR-COM-84 | The web route MUST support normal browser history, refresh, and direct navigation. | M |
| FR-COM-85 | Share URLs MUST NOT contain session tokens, private user identifiers, or temporary signed upload URLs. | M |

### 3.10 Profiles and contributions

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-86 | A public user profile MAY show display name, avatar, short bio, and published contributions only. Exact fields are subject to privacy review. | S |
| FR-COM-87 | A profile MUST NOT expose email address, authentication tokens, private bookmarks, unpublished drafts, or reports submitted by the user. | M |
| FR-COM-88 | Users MUST be able to browse published posts by an author from their public profile. | M |
| FR-COM-89 | Users MUST be able to find their own posts, drafts (where sync is implemented), and publication/rejection status in a private contribution-management screen. | S |
| FR-COM-90 | Public reputation counts, follower counts, badges, and leaderboards are optional and are not required for the MVP. | C |

### 3.11 Notifications and moderation feedback

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-91 | The author MUST receive an in-app status indication for their post when it is pending, published, rejected, or removed. | M |
| FR-COM-92 | A rejection notice SHOULD show a user-safe reason and link to Community Guidelines, without exposing scanner internals that enable evasion. | S |
| FR-COM-93 | Notifications for comments/reactions/replies MAY be added after core publishing and deep linking; notification delivery MUST link to the relevant canonical post. | C |

### 3.12 Non-functional requirements

#### 3.12.1 Performance

| ID | Requirement | Priority |
|---|---|---|
| NFR-COM-1 | On a typical broadband/mobile connection, the Community shell and first useful feed content SHOULD become visible within 2.5 seconds at the 75th percentile; confirm measurement conditions before release. | S |
| NFR-COM-2 | Feed and library APIs MUST paginate; query and filter changes MUST NOT fetch the entire corpus. | M |
| NFR-COM-3 | Images MUST use responsive thumbnails/derivatives in cards; full-resolution images SHOULD be loaded only in the viewer. | M |
| NFR-COM-4 | Upload progress MUST be visible for operations that normally take more than one second. | S |
| NFR-COM-5 | Moderation scanning MUST be asynchronous where needed and MUST not make unapproved content publicly available while the scan runs. | M |

#### 3.12.2 Reliability and availability

| ID | Requirement | Priority |
|---|---|---|
| NFR-COM-6 | A failed feed request MUST display a recoverable error state with retry; it MUST not silently display stale content as current without indication. | M |
| NFR-COM-7 | A retryable upload failure MUST permit retry without duplicate post creation where idempotency is supported. | S |
| NFR-COM-8 | Link routes MUST return the correct page after direct entry, refresh, cold start, and browser Back/Forward navigation. | M |
| NFR-COM-9 | Moderation, decoding, and attachment delivery failures MUST fail closed for unreviewed content. | M |

#### 3.12.3 Security and privacy

| ID | Requirement | Priority |
|---|---|---|
| NFR-COM-10 | All client/server traffic MUST use HTTPS. | M |
| NFR-COM-11 | The server MUST authenticate write operations and authorize access by post ownership and role. | M |
| NFR-COM-12 | Upload storage MUST separate quarantined content from publicly deliverable approved assets. | M |
| NFR-COM-13 | Server-side validation MUST protect against spoofed MIME types, malformed images/PDFs, oversized uploads, path/URL injection, and abusive request rates. | M |
| NFR-COM-14 | The system MUST minimize personal data collection and provide privacy-policy disclosures for public profiles, user uploads, analytics, and moderation processing. | M |
| NFR-COM-15 | Moderation logs MUST avoid embedding raw prohibited image content or sensitive private URLs. | M |
| NFR-COM-16 | Public endpoints MUST not return private drafts, rejected items, reporter identity, internal review notes, or privileged user data. | M |
| NFR-COM-17 | User-generated content MUST be safely rendered; untrusted HTML/scripts MUST be sanitized or not executed. | M |
| NFR-COM-18 | The system MUST have a defined retention/deletion policy for quarantined, rejected, removed, and user-deleted files before production launch. | M |
| NFR-COM-19 | The system MUST use server-side rate limits for post creation, comments, reports, and uploads in addition to client-side guards. | M |

#### 3.12.4 Usability and accessibility

| ID | Requirement | Priority |
|---|---|---|
| NFR-COM-20 | Website and app layouts MUST adapt to phones, tablets, and desktop/laptop widths. | M |
| NFR-COM-21 | Interactive controls and attachment previews MUST have accessible names, keyboard support on web, and visible focus states. | M |
| NFR-COM-22 | Color MUST NOT be the only method used to communicate publication/moderation status. | M |
| NFR-COM-23 | Public web pages SHOULD meet WCAG 2.1 AA contrast and interaction expectations; formal audit is TBD. | S |
| NFR-COM-24 | The notes viewer MUST support reasonable zoom and page/image navigation on touch and pointer devices. | S |

#### 3.12.5 Maintainability and observability

| ID | Requirement | Priority |
|---|---|---|
| NFR-COM-25 | Academic matching, URL construction, moderation-state mapping, and permission logic MUST be covered by unit/integration tests. | M |
| NFR-COM-26 | Backend changes MUST include schema/API validation tests and authorization tests. | M |
| NFR-COM-27 | Operational metrics SHOULD include upload failures, moderation outcomes/latency, report queue age, and deep-link success/fallback rates without collecting unnecessary sensitive data. | S |
| NFR-COM-28 | Feature availability MAY be controlled by server-side configuration or existing feature flags; disabling Community MUST not corrupt PYQ/syllabus functionality. | S |

### 3.13 External interface requirements

#### 3.13.1 User interfaces

- IR-COM-1: The visual style MUST follow existing PYQDeck website and Expo design systems rather than introduce a visually separate product.
- IR-COM-2: Required screens are: Community Feed, Notes Library, Create Post, Post Detail, Image/PDF Viewer, Doubt Discussion, Filters, Academic Profile/Preferences, Public Profile, My Posts/Contribution Status, and Moderator Queue.
- IR-COM-3: Website screens MUST be responsive and support direct URL navigation; app screens MUST use native-friendly controls and the existing responsive shell conventions.
- IR-COM-4: Feed cards MUST distinguish note, doubt, PYQ solution, and tip posts with text/icon labels in addition to color.
- IR-COM-5: Upload and moderation states MUST be presented with explanatory text, accessible status semantics, and recovery actions.
- IR-COM-6: Share and copy-link controls MUST use platform-native sharing where available and provide a fallback.

#### 3.13.2 Proposed software interfaces

The following endpoint patterns are **proposed API contracts**. Before implementation, compare them with the current backend and reuse/extend equivalent routes rather than duplicate the API.

| ID | Proposed interface | Purpose |
|---|---|---|
| IR-COM-7 | `GET /api/community/feed?sort=&cursor=&branchId=&semester=&subjectId=` | Paginated published feed |
| IR-COM-8 | `GET /api/community/notes?q=&branchId=&semester=&subjectId=&moduleId=&topicId=&cursor=` | Search/filter published resources |
| IR-COM-9 | `GET /api/community/posts/:idOrSlug` | Resolve published post and canonical metadata |
| IR-COM-10 | `POST /api/community/posts` | Create post metadata after upload/validation prerequisites |
| IR-COM-11 | `PATCH /api/community/posts/:id` | Edit own post; changed version re-enters moderation |
| IR-COM-12 | `DELETE /api/community/posts/:id` | Withdraw/delete own post |
| IR-COM-13 | `POST /api/community/posts/:id/comments`, `GET /api/community/posts/:id/comments` | Create/list comments |
| IR-COM-14 | `PUT /api/community/posts/:id/reaction`, `DELETE /api/community/posts/:id/reaction` | Set/remove user's reaction |
| IR-COM-15 | `PUT /api/community/posts/:id/bookmark`, `DELETE /api/community/posts/:id/bookmark` | Save/remove bookmark |
| IR-COM-16 | `POST /api/community/posts/:id/reports` | Report a post |
| IR-COM-17 | `GET /api/community/me/posts`, `GET /api/community/me/bookmarks` | Private post and bookmark lists |
| IR-COM-18 | `GET /api/community/profiles/:username` | Public profile and published contributions |
| IR-COM-19 | `POST /api/community/uploads/init`, `POST /api/community/uploads/:uploadId/complete` | Initialize and finalize private/quarantined upload |
| IR-COM-20 | `GET /api/admin/community/moderation` | Moderator queue |
| IR-COM-21 | `POST /api/admin/community/moderation/:postId/decision` | Record moderation decision and reason |
| IR-COM-22 | Existing subject/catalogue and question endpoints | Validate and resolve academic references |
| IR-COM-23 | Existing Clerk/session integration and backend auth middleware | Authenticate users and enforce roles |

Upload implementation MUST align with the existing server's supported upload approach. The proposed `uploads/init` interface is conceptual; it need not be implemented literally if the backend uses an existing presigned UploadThing/S3 workflow, provided quarantine and server-validated completion semantics are preserved.

#### 3.13.3 Communications interfaces

- IR-COM-24: Website, app, API, and attachment delivery MUST use HTTPS.
- IR-COM-25: Android App Links require a valid `/.well-known/assetlinks.json` on the production domain, with the correct package name and signing certificate fingerprint.
- IR-COM-26: iOS Universal Links require an Apple App Site Association file and matching associated-domains configuration if iOS distribution is supported.
- IR-COM-27: App links MUST route canonical web paths to the correct Expo screen and preserve the post identifier across cold and warm starts.
- IR-COM-28: External share providers receive only canonical public URLs and public preview metadata, never temporary upload credentials or private URLs.

### 3.14 Data requirements

| ID | Requirement | Priority |
|---|---|---|
| DR-COM-1 | A community post record MUST include a stable ID, author reference, type, title, optional body, attachment references, academic context, status, created/updated timestamps, and canonical URL/slug or enough information to resolve one. | M |
| DR-COM-2 | Academic context SHOULD use stable IDs for university/curriculum, branch, semester, subject, module, topic, and linked question when catalogue entries exist. | M |
| DR-COM-3 | Each attachment MUST track a stable ID, private/quarantined storage reference, detected media type, size, scan state, and public-serving eligibility. | M |
| DR-COM-4 | Post status and attachment publication eligibility MUST be enforced by backend logic and not inferred by clients. | M |
| DR-COM-5 | Comment/reaction/bookmark/report records MUST reference their parent and actor, and enforce unique/authorization rules appropriate to each interaction. | M |
| DR-COM-6 | Moderation decisions MUST retain actor/system, timestamp, decision, reason code, and relevant scanner version or result summary without retaining prohibited payloads unnecessarily. | M |
| DR-COM-7 | Public APIs MUST return only fields required by the public page; internal scanner findings, private URLs, reporter identity, and audit notes MUST be excluded. | M |
| DR-COM-8 | The system MUST define whether deleting a post hard-deletes or soft-deletes content and the retention window for rejected/quarantined assets before launch. | M |
| DR-COM-9 | User preference data MAY include academic profile selections; those selections MUST be separable from tags attached to existing posts. | M |

### 3.15 Suggested post data shape (illustrative, not an existing schema)

```ts
type CommunityPost = {
  id: string;
  slug: string;
  authorId: string;
  type: "note" | "doubt" | "pyq_solution" | "tip";
  title: string;
  body?: string;
  attachments: Array<{
    id: string;
    mediaType: "image" | "pdf";
    displayUrl?: string; // present only when approved for public delivery
    status: "quarantined" | "scanning" | "approved" | "rejected";
    pageCount?: number;
  }>;
  academicContext: {
    universityId?: string;
    curriculumId?: string;
    branchId?: string;
    semester?: number;
    subjectId?: string;
    moduleId?: string;
    topicId?: string;
    relatedQuestionId?: string;
  };
  status: "pending" | "published" | "rejected" | "removed";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

This model is conceptual. The implementation MUST adapt names, IDs, storage strategy, timestamps, moderation substates, and author identity to the existing backend conventions. The public DTO MUST omit quarantined URLs and internal moderation details.

### 3.16 Acceptance criteria for MVP

The MVP is acceptable when all of the following pass in staging:

1. A guest can open the website Community feed and read a published post without signing in.
2. A student can create a notes post with academic tags and multiple image attachments.
3. A post with an unsafe, unsupported, or unscanned attachment never appears in the public feed or public detail page.
4. A published post has a canonical HTTPS URL, copy/share works, and metadata produces a usable preview in supported share clients.
5. The canonical link opens the same post in the Expo app when installed and opens the web post otherwise; cold start and logged-out cases are tested.
6. Feed and notes library results can be filtered by branch, semester, subject, module, and topic, and the server validates referenced catalogue entities.
7. Users can report a published post; moderators can review a queued item and record a decision.
8. A rejected or removed post is absent from feed, search, public profile lists, and public sitemap, and its attachment access is revoked or denied.
9. Ownership and role checks reject unauthorized edit/delete/moderation requests.
10. Direct web navigation, page refresh, and browser Back/Forward preserve correct Community routes.
11. Core tests cover academic matching, permissions, publication visibility, upload states, canonical URL resolution, and deep-link parsing.

---

## 4. Traceability

| Feature area | Requirement ranges | Expected implementation surfaces |
|---|---|---|
| Community navigation | FR-COM-1 to FR-COM-7 | Website router, Expo navigation shell |
| Academic profile/tagging | FR-COM-8 to FR-COM-18 | Profile/preferences UI, catalogue selectors, backend validators |
| Feed and Notes Library | FR-COM-19 to FR-COM-29 | Website feed/pages, app feed, search/filter API |
| Create/edit/delete | FR-COM-30 to FR-COM-38 | Create-post UI, author management, post API |
| Upload pipeline | FR-COM-39 to FR-COM-48 | Expo/web upload UI, storage integration, file validation |
| Moderation and reporting | FR-COM-49 to FR-COM-62 | Moderation service, admin queue, report actions, audit store |
| Comments/reactions/bookmarks | FR-COM-63 to FR-COM-69 | Post detail UI, interaction APIs |
| PYQ/syllabus integration | FR-COM-70 to FR-COM-73 | Existing question/syllabus routes and catalog references |
| Share links/deep links | FR-COM-74 to FR-COM-85 | Website route/SEO metadata, Android/iOS association files, Expo linking config |
| Profiles and contributions | FR-COM-86 to FR-COM-90 | Public profile route, private My Posts screen/API |
| Status/notifications | FR-COM-91 to FR-COM-93 | Author status screen, optional notification integration |
| Performance/security | NFR-COM-1 to NFR-COM-28 | Website/API/storage/monitoring test suites |
| Interfaces and data | IR-COM-1 to IR-COM-28, DR-COM-1 to DR-COM-9 | Shared API contract, storage schema, link configuration |

---

## 5. Open questions (TBD register)

| # | Question | Owner |
|---|---|---|
| 1 | Confirm the actual website repository, framework, existing route conventions, and canonical host. | Engineering |
| 2 | Confirm the server repository, existing Community-related schemas/routes, authentication middleware, and upload pipeline. | Backend |
| 3 | Confirm whether website sign-in uses Clerk and shares the same identity as the Expo app. | Engineering |
| 4 | Decide exact canonical route shape: slug-only, stable ID, or slug plus ID. | Engineering |
| 5 | Define max file size, image count, PDF size/page limit, supported MIME types, and upload quotas. | Product + Backend |
| 6 | Select moderation provider(s), policy thresholds, queue SLA, escalation flow, and human-review ownership. | Product + Trust/Safety |
| 7 | Define prohibited-content policy, appeal/contact process, file retention/deletion windows, and handling for suspected child sexual abuse/exploitation material with appropriate legal review. | Product + Legal/Safety |
| 8 | Decide whether comments allow attachments, Markdown, edit history, and nesting. | Product |
| 9 | Decide whether reactions are a single helpful vote or multiple reaction types. | Product |
| 10 | Decide when to notify authors of publication/rejection and whether comments/reactions notifications are in MVP. | Product |
| 11 | Confirm iOS release support and production Universal Links configuration. | Mobile |
| 12 | Decide Community navigation placement in the app (bottom tab vs secondary entry) and whether to use a feature flag. | Product + Design |
| 13 | Define public profile fields, username uniqueness, user blocking, and account deletion behaviour. | Product + Privacy |
| 14 | Confirm public-page indexability and sitemap policy for posts, profiles, and filtered URLs. | SEO + Product |
| 15 | Define measurable performance and availability targets for web/API/moderation. | Engineering |
| 16 | Determine whether local drafts are sufficient or drafts should sync across devices. | Product |

---

## 6. Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 (draft) | 2026-10-17 | Drafted against the existing PYQDeck SRS conventions and Community product discussion | Initial shared web + Expo Community SRS; proposed routes/models explicitly marked for validation |
