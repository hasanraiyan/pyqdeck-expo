# Software Requirements Specification (SRS)
# PYQDeck Community

**Version:** 2.0  
**Status:** Draft  
**Platforms:** Website, Expo mobile app, shared backend  
**Product:** PYQDeck  
**Primary audience:** Students and learners

## 1. Purpose

PYQDeck Community is a student-focused social platform where users can share study notes, handwritten images, PDFs, questions, solutions, explanations, and learning experiences.

The platform combines a social feed similar to LinkedIn with student-oriented discovery features. Users can publish posts, follow other students, interact with content, explore hashtags, and discover useful learning resources.

The experience must be simple: users should be able to create a post using one text field and optional attachments without being forced to select a university, branch, semester, subject, module, or topic.

The community must work across the PYQDeck website and Expo mobile app, with public post pages that can be shared and discovered through Google Search.

## 2. Product Goals

- Build a social learning community for students.
- Make sharing notes, questions, and solutions effortless.
- Help users discover useful content beyond the people they follow.
- Encourage meaningful interactions through reactions, comments, and follows.
- Provide personalized recommendations without relying exclusively on popularity.
- Make public posts accessible through search engines and shareable links.
- Maintain a consistent experience across web and mobile.

## 3. Homepage and Layout

The homepage SHALL provide a responsive social feed with three main areas on desktop.

### 3.1 Left Sidebar

The sidebar SHALL provide navigation to:

- Home
- Explore
- Following
- Hashtags
- Bookmarks
- My Profile

Additional destinations, such as notifications and settings, MAY be included where appropriate.

### 3.2 Main Content Feed

The center column SHALL contain:

- A post composer.
- Feed tabs: **For You**, **Following**, and **Latest**.
- Post cards with author information and content.
- Reactions, comments, views, and sharing actions.
- Pagination or efficient infinite scrolling.

### 3.3 Right Sidebar

The right sidebar SHOULD display:

- Trending hashtags.
- Recommended students to follow.
- Popular or useful study posts.
- Community activity statistics, when reliable data is available.

Recommendations and statistics MUST use real data in production. Demo data must be clearly identified as such.

### 3.4 Responsive Layout

On mobile devices:

- The main feed SHALL remain the primary focus.
- Navigation MAY use a bottom navigation bar or collapsible menu.
- Secondary sidebar content MAY move into dedicated Explore sections.
- Post actions and attachments SHALL remain usable on small screens.
- Layout changes SHALL preserve accessibility and avoid horizontal overflow.

## 4. Users and Permissions

| Role | Permissions |
|---|---|
| Guest | Browse, search, read, and share public posts and profiles |
| Signed-in user | Create posts, follow users, react, comment, bookmark, and report content |
| Moderator | Review reports and moderate posts and comments |
| Admin | Manage moderation settings, platform configuration, and moderation records |

Authentication SHALL be required for actions that modify content or account relationships. Public content SHOULD remain accessible without signing in.

## 5. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The website SHALL provide a public community homepage and individual post pages. | Must |
| FR-2 | The Expo app SHALL provide the community feed, post details, and post creation. | Must |
| FR-3 | Users SHALL create posts using one main body field with optional image or PDF attachments. | Must |
| FR-4 | A separate post title SHALL NOT be required. | Must |
| FR-5 | Creating a post SHALL NOT require academic selections or profile setup. | Must |
| FR-6 | Users MAY include hashtags directly in the post body. | Must |
| FR-7 | Users SHALL be able to follow and unfollow other users. | Must |
| FR-8 | Users SHALL be able to react to and comment on posts. | Must |
| FR-9 | Users SHALL be able to bookmark and share posts. | Must |
| FR-10 | The platform SHALL provide For You, Following, and Latest feeds. | Must |
| FR-11 | Users SHALL be able to search posts and discover hashtags. | Must |
| FR-12 | The system SHALL track post views using a defined, privacy-conscious counting method. | Must |
| FR-13 | The system SHALL generate a unique, stable URL for every published post. | Must |
| FR-14 | Public posts SHALL have SEO metadata and be eligible for Google indexing. | Must |
| FR-15 | The platform SHALL recommend relevant posts and users. | Must |
| FR-16 | Users SHALL be able to report inappropriate content. | Must |
| FR-17 | Moderators SHALL be able to review reports and remove content. | Must |
| FR-18 | The website and mobile app SHALL use consistent shared data and permissions. | Must |

## 6. Post Creation and Content

### 6.1 Composer

The post composer SHALL include:

- One main text field.
- Optional image attachments.
- Optional PDF attachments.
- A publish button.
- Upload progress and publication status.

Users SHALL NOT be required to enter a title, select academic categories, or manually generate a URL.

### 6.2 Hashtags

- Hashtags MAY be typed directly into the post body, such as `#ComputerNetworks` and `#MachineLearning`.
- The backend SHOULD extract and normalize hashtags.
- Hashtags SHALL be searchable and clickable.
- Hashtags SHALL be optional.
- The system SHOULD prevent duplicate hashtag records caused by capitalization differences.
- Users SHALL be able to discover posts associated with a hashtag.

### 6.3 Editing and Deletion

Authors SHALL be able to edit or delete their own posts, subject to moderation rules.

Edits SHALL update the displayed content, timestamps, and relevant SEO metadata. The public URL SHOULD remain stable when the body changes.

Deleted or unpublished posts SHALL no longer expose their content through public pages, feeds, or sitemaps.

## 7. Social Interactions

### 7.1 Reactions

Users SHALL be able to react to posts.

- The initial implementation MAY use a simple Like reaction.
- The system SHOULD support extending reactions to additional types later.
- A user SHALL NOT create duplicate active reactions of the same type on a post.
- Users SHALL be able to remove their reactions.
- Reaction counts SHALL update consistently across the website and mobile app.

### 7.2 Comments

Users SHALL be able to comment on posts.

- Comments SHALL display the author's identity and creation time.
- Users SHALL be able to delete their own comments.
- Moderators SHALL be able to remove inappropriate comments.
- The system MAY support comment replies in a later release.
- Comment creation SHALL be protected by authentication, validation, and rate limits.

### 7.3 Following

Users SHALL be able to follow and unfollow other users.

- Follow relationships SHALL be stored by the backend.
- Users SHALL be able to view their followers and following lists.
- The Following feed SHALL include eligible posts from followed accounts.
- Recommended users SHOULD consider interests, interaction patterns, and content relevance.
- Duplicate follow relationships SHALL NOT be allowed.
- The system SHALL prevent users from following themselves.

### 7.4 Bookmarks

Users SHALL be able to bookmark posts and remove bookmarks.

Bookmarks SHALL be private to the user by default and available across supported devices when signed in.

### 7.5 Sharing

Users SHALL be able to copy a post URL or use the device's native sharing menu.

Shared links SHALL NOT expose authentication tokens, private drafts, or private attachment URLs.

## 8. Views and Engagement Metrics

The system SHALL track views to help users understand post reach and support content recommendations.

### 8.1 View Counting

- A view SHALL be recorded when a post is meaningfully opened or viewed according to a documented counting policy.
- Repeated refreshes or rapid repeated requests SHOULD NOT inflate view counts without limit.
- The implementation SHOULD deduplicate views over a configurable time window using an appropriate privacy-conscious mechanism.
- Automated traffic and obvious abuse SHOULD be filtered where practical.
- The system SHALL avoid collecting unnecessary personal information solely to count views.

### 8.2 Displaying Metrics

Post cards MAY display:

- View count.
- Reaction count.
- Comment count.
- Share count, if reliable share events are recorded.

The platform SHALL distinguish between recorded activity and estimated metrics. Counts SHOULD update consistently after interactions.

### 8.3 Metric Limitations

Views alone SHALL NOT determine ranking. The system SHOULD balance reach with content quality, relevance, freshness, and meaningful interactions.

## 9. Feed and Recommendation Algorithm

The platform SHALL support three feed modes.

### 9.1 For You

For You SHALL recommend posts that are likely to be useful or interesting to the current user.

The initial recommendation system SHOULD consider:

- Relevance of post text and hashtags.
- Accounts the user follows.
- Recent interactions, such as likes, comments, and bookmarks.
- Post freshness.
- Meaningful engagement.
- Content quality and moderation status.
- Diversity of authors and topics.

The system MUST NOT rely exclusively on raw view counts or likes.

### 9.2 Following

The Following feed SHALL prioritize eligible posts from accounts followed by the user.

The default ordering SHOULD be chronological or near-chronological, with the newest eligible posts first.

### 9.3 Latest

The Latest feed SHALL display eligible public posts in reverse chronological order, independently of popularity.

### 9.4 Initial Ranking Strategy

A simple weighted scoring model MAY be used for the first version:

`score = relevance + freshness + meaningful_engagement + follow_affinity + quality - spam_penalty`

Each component SHALL be normalized and weighted before calculating the final score.

The system SHOULD:

- Apply moderation and visibility rules before ranking.
- Reduce the influence of repeated or artificial engagement.
- Avoid allowing a single author to dominate the feed.
- Avoid excessive repetition of similar posts.
- Include fresh content from smaller accounts.
- Provide a Latest feed so users can bypass personalized ranking.

The exact weights SHALL be configurable and evaluated using real platform data. The formula is a starting design, not a claim that a validated recommendation model already exists.

### 9.5 Cold Start

For new users without interaction history, the system SHOULD recommend recent, high-quality public posts and diverse content.

Users SHALL NOT be required to select academic interests or complete an onboarding questionnaire before using the community.

## 10. Explore, Search, and Hashtags

The Explore experience SHALL help users find useful content and accounts.

It SHOULD include:

- Search by post text.
- Hashtag discovery.
- Trending hashtags.
- Popular recent posts.
- Recommended users.
- Relevant public profiles.

Search results SHALL respect publication status, moderation rules, and visibility permissions.

Hashtag trends SHOULD be calculated from recent, meaningful activity rather than lifetime totals alone. Spam and artificial engagement SHOULD be excluded.

Empty or low-value hashtag pages SHOULD NOT automatically become indexable Google landing pages.

## 11. Notifications

The platform SHOULD support notifications for relevant social events, including:

- New followers.
- Reactions to a user's posts.
- Comments on a user's posts.
- Replies, if supported.
- Moderation outcomes relevant to the user.

Users SHOULD be able to control supported notification preferences.

Notifications MUST NOT reveal private content to unauthorized users. Push notifications MAY be added through the mobile app where supported.

## 12. Public URLs, Sharing, and Deep Links

### 12.1 Automatic URLs

Each published post SHALL receive a unique, stable HTTPS URL under the configured domain.

Example:

`https://pyqdeck.in/community/my-post-slug`

- The system SHALL generate the slug or identifier automatically.
- Users SHALL NOT create URLs manually.
- Duplicate slugs SHALL be resolved automatically.
- The public URL SHOULD remain stable after edits.
- The backend SHALL be the source of truth for URL resolution.

### 12.2 Deep Linking

Opening a shared URL SHOULD open the matching post in the Expo app when the app is installed and the platform supports the link configuration.

Otherwise, the link SHALL open the website.

Android App Links SHOULD be configured. iOS Universal Links SHOULD be included when iOS is supported.

### 12.3 Removed Content

Deleted, private, or unpublished posts SHALL NOT expose their content through old share links. The website SHALL return an appropriate unavailable page and HTTP status.

## 13. Google SEO and Public Indexing

### 13.1 Crawlable Post Pages

Every eligible public post SHALL have an individual, crawlable website page.

- Public pages SHALL be accessible without authentication.
- Server-side rendering or static generation SHOULD be used so the primary post content and metadata are available in the initial HTML.
- Post content SHALL be readable by search engines without requiring a user to sign in.
- Public post links SHALL be discoverable through crawlable HTML anchors.
- The website SHALL return appropriate HTTP status codes.

### 13.2 Metadata

The system SHALL generate SEO metadata automatically from post content.

Each eligible public post SHOULD have:

- A unique descriptive page title.
- A relevant meta description.
- A canonical HTTPS URL.
- Open Graph metadata for supported social previews.
- A meaningful page heading.
- Descriptive image alternative text where available.

Users SHALL NOT need to enter a separate title or SEO description.

### 13.3 Sitemap

The website SHALL provide an XML sitemap or sitemap index.

- Eligible published posts SHALL be included automatically.
- Drafts, private posts, pending moderation items, and removed posts SHALL be excluded.
- Sitemap entries SHALL use canonical URLs.
- The sitemap SHALL be updated when posts are published or removed.
- Sitemap generation SHALL support growth in the number of posts.

### 13.4 Structured Data

The website SHOULD implement suitable Schema.org structured data, such as `DiscussionForumPosting`, where applicable.

Structured data MUST accurately represent visible content and MUST NOT contain fabricated ratings, endorsements, or hidden information.

### 13.5 Indexing Controls

Eligible public posts SHOULD be indexable.

Private, draft, and pending-moderation pages MUST NOT be publicly indexed. Removed posts SHALL be removed from the sitemap and stop serving their previous public content.

Google Search Console SHOULD be configured for sitemap submission and indexing diagnostics.

The implementation SHALL be tested for crawlability, metadata, canonical URLs, and structured data. Google indexing and ranking cannot be guaranteed.

## 14. Uploads, Security, and Moderation

- The backend SHALL validate file types, sizes, and applicable content restrictions.
- Attachment count, size, and PDF page limits SHALL be configurable.
- Private uploads MUST NOT be publicly accessible before publication.
- Content requiring moderation SHALL remain unpublished until approved.
- Moderation failures or timeouts MUST NOT automatically publish content.
- Users SHALL be able to report posts and comments.
- Moderators SHALL be able to approve, reject, or remove content.
- The system SHALL maintain appropriate private moderation records.
- Rate limits SHALL apply to posting, commenting, following, reactions, and reporting.
- The backend SHALL validate ownership and permissions for all modifying actions.
- Abuse prevention SHOULD detect repetitive spam and artificial engagement.
- Public content and attachments SHALL be removed or restricted according to deletion and retention rules.

## 15. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Feeds and search SHALL be paginated. Queries SHOULD use suitable indexes. |
| SEO | Eligible public pages SHALL provide crawlable content, canonical URLs, and metadata. |
| Security | Authentication, authorization, rate limits, and upload validation SHALL be enforced server-side. |
| Privacy | Private account information, drafts, bookmarks, and moderation records SHALL remain protected. |
| Reliability | Failed requests SHALL provide understandable error states and recoverable actions. |
| Accessibility | Website controls SHALL support keyboard navigation, accessible labels, and readable contrast. |
| Scalability | Feed ranking, view aggregation, search, and sitemap generation SHOULD support growing usage. |
| Consistency | Website and Expo app SHALL use shared data and publication rules. |
| Maintainability | Existing authentication, storage, routing, and backend infrastructure SHOULD be reused where appropriate. |
| Observability | Important failures and backend errors SHOULD be logged without unnecessarily exposing personal data. |

## 16. Suggested Data Model

The following entities are proposed and should be adapted to the existing database.

### User

- User ID.
- Display name and username.
- Optional profile image and bio.
- Account status.
- Created timestamp.

### Post

- Post ID.
- Automatically generated slug or public URL identifier.
- Author ID.
- Body text.
- Optional attachments.
- Optional hashtags.
- Publication and moderation status.
- Creation and update timestamps.
- Publication timestamp.

### Follow

- Follower user ID.
- Followed user ID.
- Creation timestamp.

The follower and followed user IDs SHALL form a unique relationship.

### Reaction

- Reaction ID.
- User ID.
- Post ID.
- Reaction type.
- Creation timestamp.

The implementation SHALL prevent duplicate active reactions according to the selected reaction policy.

### Comment

- Comment ID.
- Post ID.
- Author ID.
- Comment body.
- Creation and update timestamps.
- Moderation status.

### Bookmark

- User ID.
- Post ID.
- Creation timestamp.

A user SHALL NOT have duplicate bookmarks for the same post.

### Post View

- Post ID.
- Timestamp or time bucket.
- Privacy-conscious deduplication identifier where necessary.
- Optional aggregation metadata.

Raw view events SHOULD be minimized or aggregated according to the platform's retention policy.

### Hashtag

- Hashtag ID.
- Normalized hashtag value.
- Display value.

### Post Hashtag

- Post ID.
- Hashtag ID.

This relationship SHALL prevent duplicate associations.

### Report and Moderation Record

- Report ID.
- Reporter ID.
- Reported content ID and type.
- Reason and creation timestamp.
- Review status.
- Moderator decision and timestamp.

Moderation data SHALL remain private.

## 17. Proposed API

These endpoints are examples, not confirmed existing routes. They must be adapted to the current backend conventions.

| Endpoint | Purpose |
|---|---|
| `GET /api/community/feed?type=for-you` | Retrieve recommended posts |
| `GET /api/community/feed?type=following` | Retrieve posts from followed accounts |
| `GET /api/community/feed?type=latest` | Retrieve newest public posts |
| `GET /api/community/posts/:idOrSlug` | Retrieve an individual public post |
| `POST /api/community/posts` | Create a post |
| `PATCH /api/community/posts/:id` | Edit a post |
| `DELETE /api/community/posts/:id` | Delete a post |
| `POST /api/community/posts/:id/reactions` | Add or change a reaction |
| `DELETE /api/community/posts/:id/reactions` | Remove a reaction |
| `GET /api/community/posts/:id/comments` | Retrieve comments |
| `POST /api/community/posts/:id/comments` | Create a comment |
| `POST /api/community/users/:id/follow` | Follow a user |
| `DELETE /api/community/users/:id/follow` | Unfollow a user |
| `GET /api/community/users/:id/followers` | Retrieve followers |
| `GET /api/community/users/:id/following` | Retrieve followed accounts |
| `PUT /api/community/posts/:id/bookmark` | Bookmark a post |
| `DELETE /api/community/posts/:id/bookmark` | Remove a bookmark |
| `GET /api/community/search?q=...` | Search public content |
| `GET /api/community/hashtags/:tag` | Discover posts by hashtag |
| `POST /api/community/posts/:id/views` | Record a qualified view event |
| `POST /api/community/posts/:id/reports` | Report content |
| `GET /api/admin/community/moderation` | Retrieve moderation queue |
| `POST /api/admin/community/moderation/:id/decision` | Record moderation decision |

The backend SHALL enforce authentication, authorization, validation, and rate limits regardless of which client calls an endpoint.

## 18. MVP Acceptance Checklist

### Homepage and feed

- [ ] Homepage displays a responsive community feed.
- [ ] Desktop layout supports navigation, main feed, and discovery sidebar.
- [ ] Mobile layout remains readable and usable.
- [ ] For You, Following, and Latest feeds work as specified.
- [ ] Feeds display real content from the shared backend.

### Posting and interactions

- [ ] Users can publish text-only posts.
- [ ] Images and PDFs are optional attachments.
- [ ] No title or academic selections are required.
- [ ] Hashtags are optional and searchable.
- [ ] Users can react, comment, follow, unfollow, bookmark, and share.
- [ ] View counts use the documented counting policy.
- [ ] Users can report content and moderators can remove it.

### Recommendations

- [ ] For You considers relevance, freshness, follows, and meaningful engagement.
- [ ] Following shows posts from followed accounts.
- [ ] Latest shows posts in chronological order.
- [ ] Raw views alone do not determine rankings.
- [ ] New users can discover content without completing a profile questionnaire.

### Sharing and SEO

- [ ] Every published post receives a unique automatic URL.
- [ ] Public post pages work without authentication.
- [ ] Shared links resolve to the correct post.
- [ ] Supported mobile deep links open the matching post.
- [ ] Eligible posts have unique metadata and canonical URLs.
- [ ] The sitemap includes eligible posts and excludes unpublished content.
- [ ] Structured data, if used, matches visible content.
- [ ] Google Search Console can be used to monitor indexing.
- [ ] The team acknowledges that Google indexing and rankings are not guaranteed.

### Safety and reliability

- [ ] Uploads are validated.
- [ ] Pending moderation content is not publicly exposed.
- [ ] Private data and moderation records are protected.
- [ ] Authorization and rate limits are enforced server-side.
- [ ] Website and mobile app remain consistent.

## 19. Implementation Notes and Decisions

Before implementation, confirm:

1. Which existing website and backend repositories should be updated.
2. Whether the website and Expo app use the same authentication identity.
3. Attachment limits and upload storage configuration.
4. The moderation provider and review process.
5. Whether iOS Universal Links are required in the first release.
6. The retention policy for removed content and view events.
7. Which search infrastructure should power content and hashtag discovery.

Implementation SHOULD be incremental: establish posting and public pages first, then social interactions, followed feeds, view aggregation, recommendations, and SEO validation. Existing infrastructure SHOULD be reused rather than introducing unnecessary services.

## Revision History

| Version | Changes |
|---|---|
| 1.0 | Initial community requirements |
| 1.1 | Simplified document structure |
| 1.2 | Body-first posts and optional hashtags |
| 1.3 | Removed mandatory academic selections |
| 1.4 | Automatic URLs and removal of manual PYQ/syllabus linking |
| 1.5 | Public-page SEO and Google indexing |
| 2.0 | Homepage, social interactions, follows, views, recommendations, Explore, and notifications |