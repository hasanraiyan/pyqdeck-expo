# SRS: PYQDeck Community

| Field | Value |
|---|---|
| Product | PYQDeck Community (Website + Expo app + shared backend) |
| Version | 1.2 |
| Date | 2026-10-17 |
| Status | Draft |
| Audience | Product, web, mobile, backend, and QA teams |

Priority: **M** = Must, **S** = Should, **C** = Could. This document describes the intended feature. API routes and data structures below are proposals and must be checked against the existing code before implementation.

## 1. Purpose

PYQDeck Community lets students share and discover study notes, handwritten images, PDFs, doubts, PYQ solutions, and study tips through a simple, social feed.

The feature must work on both the website and Expo app. A shared link should open the same post in the app when installed, or in the website otherwise.

## 2. Scope

Included:
- Public community feed and searchable notes library.
- Create posts with images or PDFs.
- Optional hashtags in post bodies for discovery (for example, #ComputerNetworks or #Semester6).
- Doubts, comments, helpful reactions, bookmarks, and reports.
- Links to existing PYQs and syllabus topics.
- Shareable web pages, social previews, and app deep links.
- Upload screening, moderation, and admin review.
- Responsive web and mobile layouts.

Not included in the first version: direct messaging, live chat, monetization, or AI-generated answers.

## 3. Users

| User | Permissions |
|---|---|
| Guest | Browse, search, read, and share published posts |
| Signed-in student | Create and manage own posts, comment, react, bookmark, and report |
| Moderator | Review reported/pending posts and remove unsafe content |
| Admin | Manage moderation and review audit records |

Users should be able to browse without signing in or completing an academic profile. Sign-in is required for actions that change content.

## 4. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The website SHALL provide a Community page and individual public post pages. | M |
| FR-2 | The Expo app SHALL provide a Community feed, post details, notes viewer, and create-post flow. | M |
| FR-3 | Users SHALL be able to share notes, ask doubts, post PYQ solutions, and share study tips. | M |
| FR-4 | Posts SHALL use one main body field with optional image/PDF attachments. A separate title field SHALL NOT be required. | M |
| FR-5 | Users SHOULD be able to add hashtags in the body. Hashtags SHALL support search and discovery. | M |
| FR-6 | Users SHALL be able to search and filter posts by hashtag and post type. No branch, semester, subject, module, or topic selection SHALL be required to publish. | M |
| FR-7 | The feed SHOULD help users discover relevant posts without requiring an academic profile. | S |
| FR-8 | Authors SHALL be able to edit or remove their own posts. Edited content or attachments MUST be checked again before publication. | M |
| FR-9 | Users SHALL be able to comment, react/helpful-vote, bookmark, and report eligible posts. | M |
| FR-10 | A post MAY link to an existing PYQ question or syllabus resource, but such linking SHALL be optional. | M |
| FR-11 | Users SHALL see upload progress and clear pending, published, rejected, or failed states. | M |
| FR-12 | Users SHALL be able to see the status of their own posts. | S |
| FR-13 | Public feeds, search results, profiles, and pages MUST show only published posts. | M |
| FR-14 | The system SHALL provide a moderator queue for pending or reported content. Moderators must be able to approve, reject, or remove content with a recorded reason. | M |

## 5. Website sharing and app deep links

| ID | Requirement | Priority |
|---|---|---|
| LINK-1 | Every published post SHALL have a stable HTTPS URL on the official PYQDeck domain. Example: `https://pyqdeck.in/community/:slug`. | M |
| LINK-2 | Website and app SHALL offer native sharing where available and a copy-link fallback. | M |
| LINK-3 | Opening a shared link SHALL show the same post on the website when the app is unavailable. | M |
| LINK-4 | When installed, the Expo app SHOULD open supported HTTPS links directly to the matching post, including on a cold start. | M |
| LINK-5 | Android App Links and iOS Universal Links SHALL be configured for supported platforms. | M |
| LINK-6 | Public post pages SHOULD include canonical metadata and social preview title, description, and safe thumbnail. | M |
| LINK-7 | Unknown, removed, or unpublished posts SHALL show an appropriate unavailable page and MUST NOT reveal private moderation details. | M |
| LINK-8 | Share URLs MUST NOT contain authentication tokens or temporary/private upload URLs. | M |

## 6. Upload safety and moderation

All uploads must be private until the system has checked them. **Unreviewed files must never appear in the public feed or be accessible through public permanent URLs.**

1. Validate the actual file type, file size, and file contents on the server.
2. Store uploads in private quarantine or an equivalent non-public state.
3. Scan every image and supported document for prohibited content; do not assume a whole post is safe because one attachment passed.
4. Publish only when the moderation policy permits it.
5. Send uncertain results to human review; reject prohibited content.
6. If scanning fails or times out, keep the post unpublished.
7. Provide report actions and allow moderators to remove content after publication.
8. Record moderation decisions without putting prohibited image contents or private URLs in ordinary logs.
9. Define retention and deletion rules for rejected and removed uploads before launch.

Content suspected to involve sexual exploitation of minors requires a restricted safety escalation process, not routine public moderation.

## 7. Non-functional requirements

- **Performance:** Feed and search must be paginated; feed cards should use optimized image thumbnails.
- **Security:** Use HTTPS, server-side authentication, ownership checks, role checks, upload validation, and rate limits.
- **Privacy:** Do not expose private profiles, email addresses, bookmarks, reports, drafts, or internal moderation notes.
- **Reliability:** Failed uploads and feed requests must show a recoverable error state.
- **Accessibility:** Web pages must support keyboard navigation, visible focus, readable contrast, and responsive layouts.
- **Consistency:** Website and app must use the same backend records and publication rules.
- **Testing:** Test permissions, academic filters, upload moderation, direct URL navigation, share previews, and app deep links.

## 8. Proposed API and data

These are suggested API contracts, not claims that the routes already exist. Reuse or extend equivalent endpoints in the current backend.

| Proposed endpoint | Purpose |
|---|---|
| `GET /api/community/feed` | Paginated published feed |
| `GET /api/community/notes` | Search and filter notes |
| `GET /api/community/posts/:idOrSlug` | Fetch a published post |
| `POST /api/community/posts` | Create a post |
| `PATCH /api/community/posts/:id` | Edit own post |
| `DELETE /api/community/posts/:id` | Remove own post |
| `GET/POST /api/community/posts/:id/comments` | Read or add comments |
| `PUT/DELETE /api/community/posts/:id/bookmark` | Add or remove bookmark |
| `POST /api/community/posts/:id/reports` | Report a post |
| `GET /api/admin/community/moderation` | Review moderation queue |
| `POST /api/admin/community/moderation/:id/decision` | Record moderation decision |

The implementation must follow the existing backend's authentication and upload approach.

A post record will generally need: stable ID, slug, author ID, post type, body, attachment references, hashtags, status, and timestamps. A separate title or structured academic selections are not required. Attachments need their media type and moderation/publication state. This is a conceptual model; adapt it to the current database conventions.

## 9. MVP acceptance checklist

- [ ] Guests can browse and read published posts on the website.
- [ ] Signed-in students can create a body-first post with optional hashtags and images/PDFs, without filling out academic dropdowns.
- [ ] Hashtag search returns relevant posts.
- [ ] Pending or unsafe uploads never appear publicly.
- [ ] Users can share a canonical link with a useful preview.
- [ ] The link opens the same post in the app when installed and the website otherwise.
- [ ] Users can report a post and moderators can record a decision.
- [ ] Removed posts disappear from feeds/search and their public attachment access is revoked.
- [ ] Direct web navigation, refresh, browser history, and app cold-start links work.
- [ ] Authorization and moderation tests pass.

## 10. Decisions to confirm

1. Which website and backend repositories/routes should this integrate with?
2. Does the website use the same Clerk identity as the Expo app?
3. What are the upload size, file-count, and PDF page limits?
4. Which moderation service and human-review process will be used?
5. What are the retention rules for rejected/deleted uploads?
6. Will iOS deep links be supported in the first release?
7. Should comments support attachments or replies?

## Revision history

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-10-17 | Initial detailed draft |
| 1.1 | 2026-10-17 | Simplified structure and condensed requirements |
| 1.2 | 2026-10-17 | Simplified posting to body, optional hashtags, and attachments; removed mandatory academic selections |
