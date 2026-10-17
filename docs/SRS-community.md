# SRS: PYQDeck Community, Profile, Inbox & Search Architecture

| Field | Value |
|---|---|
| Product | PYQDeck Mobile App (`pyqdeck-expo`) |
| Feature Set | Community Feed, Student Profiles, Unified Activity/Inbox, Slide-to-Dismiss, and Embedded Search |
| Version | 2.0 (Implemented) |
| Date | 2026-10-17 |
| Status | Current Shipped Specification |
| Audience | Engineering, Product, Design, QA |

---

## 1. Purpose & Overview

The PYQDeck Community ecosystem allows university students (primarily Bihar Engineering University) to share handwritten notes, PYQ solutions, academic doubts, and semester updates in a streamlined social feed. 

This document defines the functional requirements and architectural specifications for the features built to date:
1. **Community Feed**: Body-first posts, multi-image carousels, document previews, comment bottom sheets, and native ads.
2. **Student Profile**: Cover banners, academic credentials, social portfolio links, follow network, and own/saved post tabs.
3. **Unified Activity & Inbox**: Single consolidated stream for direct messages, upvotes, comments, exam routine notices, and follow alerts.
4. **Slide-to-Dismiss**: Native-driver swipe-to-dismiss gesture on notification cards with layout collapse.
5. **Embedded Search**: In-place search integrated directly into the PYQ Home header.
6. **4-Tab Navigation**: Clean bottom tab bar (PYQ, Study, Community, Activity).

---

## 2. Implemented Scope

### 2.1 Community Feed (`CommunityFeedScreen.tsx`)
- **Body-First Posting**: Posts prioritize text content without requiring rigid title or category dropdowns.
- **Hashtag Discovery**: Interactive `#hashtags` embedded in posts; tapping a hashtag filters the feed instantly.
- **Multi-Image Carousel (`CommunityMultiImageCarousel.tsx`)**: Horizontal swiping across 1–5 images with pagination dot indicators (implemented with `ScrollView` to avoid React Native `VirtualizedList` nesting warnings).
- **Document Previews (`CommunityDocumentSlide.tsx`)**: Clean document cards with page counts, file type badges, and slide thumbnail previews.
- **Interactive Comments Bottom Sheet (`CommunityCommentsBottomSheet.tsx`)**: Slide-up comments sheet with instant reply inputs and comment counts.
- **Header Layout**:
  - Left: Official PyQdeck logo (`40x40`, radius `11`), title (`rf(22)`), and subtitle ("BEU COMMUNITY").
  - Right: Expandable inline search button, borderless message icon (`message-circle`), and User Profile/Settings avatar.
- **Floating Action Button (FAB)**: Elevated pill-shaped button (`+ Post`) anchored in the bottom-right corner (`bottom: 12`, `right: 16`) for natural thumb reachability.

### 2.2 Inline Native Advertisements (`CommunityInlineAdCard.tsx`)
- Clean, minimalist ad cards inserted naturally into the community feed stream.
- Placement cadence: Displays after post #3, then repeats every 5 posts.
- Removed intrusive "Sponsored" badges and info icons for an uncluttered, native appearance.
- Respects paid-ad removal entitlements.

### 2.3 User Profile System (`UserProfileScreen.tsx`, `userProfileService.ts`)
- **Visual Identity**: Full-width cover image with dark gradient, elevated avatar with fallback initials, and notification bell toggle.
- **Academic Credentials**: Displays college name, branch, semester, and contributor rank (e.g., "ECE 6th Sem • GEC Patna • Top Contributor").
- **Portfolio & Social Links**: Interactive icon buttons for:
  - Personal Website / Portfolio (`globe`)
  - Twitter / X (`twitter`)
  - GitHub (`github`)
  - LinkedIn (`linkedin`)
- **Social Graph**: Follower and following counters with optimistic follow/unfollow state toggling.
- **Profile Action Row**:
  - Own profile: "Edit profile" (modal editing all profile fields) and "More options".
  - Peer profile: "Follow/Following", "Message" (opens direct conversation), and "More options".
- **Tabs**: "Posts" (authored posts), "Saved" (bookmarked posts), and "About" (biography and academic stats).

### 2.4 Unified Activity & Inbox System (`ActivityInboxScreen.tsx`)
- **Consolidated Feed**: Merged notifications and peer student direct messages into a single chronological stream.
- **Direct Message Cards**: Show sender avatar, college tag, quoted message preview, timestamp, and unread indicator dot.
- **Activity Cards**: Categorized with distinctive icon badges:
  - Upvotes: Green `arrow-up`
  - Comments: Blue `message-square`
  - University Notices: Amber `bell`
  - Follows: Purple `user-plus`
- **Filter Chips**: Single-tap filter pills at top:
  - **All**: Complete stream.
  - **Unread**: Only items pending review.
  - **Messages**: Direct student peer chats.
  - **Activity**: Upvotes, comments, notices, and follows.
- **Bulk Action**: "Mark all as read" button when unread items are present.
- **Back Navigation**: Automatically displays a back arrow when pushed from headers.

### 2.5 Slide-to-Dismiss Gesture (`SwipeableDismissItem.tsx`)
- **Gesture Priority**: Horizontal swipe detection (`|dx| > 10` and `|dx| > 1.5 * |dy|`) ensures vertical feed scrolling is never interrupted.
- **Performance**: Animated with `useNativeDriver: true` running on the native UI thread at 60/120fps.
- **Hidden Layer & Opacity Interpolation**:
  - Red background layer with trash icon and "Dismiss" text sits behind the card.
  - Dynamic opacity interpolation (`bgOpacity` = `0` when `translateX == 0`) guarantees that card taps or press states never bleed red through translucent backgrounds.
  - Red background only fades in when actively dragging left.
- **Auto-Dismiss & Collapse**: Dragging past 28% screen width or releasing with velocity (`vx < -0.6`) slides the card off-screen, triggers haptic feedback (`Medium`), and triggers `LayoutAnimation` so remaining cards smoothly glide up.
- **Spring Reset**: Releasing before the threshold snaps the card back to origin with smooth bounciness.

### 2.6 PYQ Home Embedded Search (`HomeScreen.tsx`, `SearchScreen.tsx`)
- **In-Place Search Transition**: Tapping the search icon in the PYQ Home header mounts an embedded `<SearchScreen embedded onClose={...} autoFocus />` directly inside the screen container.
- **Embedded Chrome**: Renders a dedicated back arrow button and auto-focused search input bar.
- **Hardware Back Handling**: Hardware `BackHandler` on Android closes the embedded search view and returns to the standard home view without navigating back through history.
- **Header Uniformity**: PYQ Home header matches Community header styling 1:1.

### 2.7 Navigation Architecture (`App.tsx`)
- **Bottom Tab Navigator**:
  1. **PYQ** (`file-text`): Home subject cards, recent study history, and question list.
  2. **Study** (`book-open`): Syllabus modules, topic notes, and past paper mappings.
  3. **Community** (`users`): Social feed, notes sharing, and discussions.
  4. **Activity** (`bell`): Consolidated notifications and inbox with unread count badge.
- **Universal Linking Paths**:
  - `pyqdeck.in/community` -> Community Feed
  - `pyqdeck.in/community/:slug` -> Post Detail
  - `pyqdeck.in/community/u/:userId` -> User Profile
  - `pyqdeck.in/inbox` -> Activity / Inbox
  - `pyqdeck.in/search` -> Search Screen
  - Keyboard shortcut (`/`, `Ctrl+K`) maps to Search on desktop/web.

---

## 3. Functional Requirements

| ID | Description | Component | Status |
|---|---|---|---|
| **FR-COM-1** | Feed SHALL display posts with author, college badge, body text, hashtags, and media. | `CommunityFeedScreen` | Implemented |
| **FR-COM-2** | Multi-image posts SHALL render a horizontal preview carousel with dot pagination. | `CommunityMultiImageCarousel` | Implemented |
| **FR-COM-3** | Document posts SHALL render page count and page slide previews. | `CommunityDocumentSlide` | Implemented |
| **FR-COM-4** | Feed SHALL render native ad cards after post #3, then every 5 posts. | `CommunityInlineAdCard` | Implemented |
| **FR-COM-5** | Tapping a hashtag in a post body SHALL filter the feed to that tag. | `CommunityFeedScreen` | Implemented |
| **FR-COM-6** | Top header SHALL provide an inline expandable search input bar. | `CommunityFeedScreen` | Implemented |
| **FR-COM-7** | Top header SHALL provide a borderless `message-circle` button opening the Activity tab. | `CommunityFeedScreen` | Implemented |
| **FR-COM-8** | Screen SHALL provide a floating action button (FAB) in the bottom-right corner for creating posts. | `CommunityFeedScreen` | Implemented |
| **FR-COM-9** | Comments button SHALL open an interactive bottom sheet with comments and reply input. | `CommunityCommentsBottomSheet` | Implemented |
| **FR-PRF-1** | User profile SHALL display cover banner, avatar, bio, and college/branch details. | `UserProfileScreen` | Implemented |
| **FR-PRF-2** | Profile SHALL provide clickable links for Website/Portfolio, Twitter/X, GitHub, and LinkedIn. | `UserProfileScreen` | Implemented |
| **FR-PRF-3** | Profile SHALL display follower/following counts with optimistic toggle on follow button. | `UserProfileScreen` | Implemented |
| **FR-PRF-4** | Profile SHALL allow owner to edit bio, college, branch, semester, and social URLs via modal. | `UserProfileScreen` | Implemented |
| **FR-PRF-5** | Profile SHALL provide tabs for authored posts and bookmarked saved posts. | `UserProfileScreen` | Implemented |
| **FR-ACT-1** | Activity screen SHALL merge direct messages and activity notifications into one timeline. | `ActivityInboxScreen` | Implemented |
| **FR-ACT-2** | Direct message items SHALL display sender avatar, college tag, message quote, and profile link. | `ActivityInboxScreen` | Implemented |
| **FR-ACT-3** | Activity screen SHALL provide filter chips for All, Unread, Messages, and Activity. | `ActivityInboxScreen` | Implemented |
| **FR-ACT-4** | Activity screen SHALL provide a "Mark all as read" button when unread items exist. | `ActivityInboxScreen` | Implemented |
| **FR-ACT-5** | Cards SHALL support slide-to-dismiss gesture to dismiss notifications with haptics. | `SwipeableDismissItem` | Implemented |
| **FR-ACT-6** | Red dismiss background SHALL have 0 opacity at rest so card taps never show red bleed-through. | `SwipeableDismissItem` | Implemented |
| **FR-NAV-1** | App SHALL feature 4 bottom tabs: PYQ, Study, Community, and Activity (with badge). | `App.tsx` | Implemented |
| **FR-NAV-2** | PYQ Home header search button SHALL open in-place embedded search with back button. | `HomeScreen.tsx` | Implemented |
| **FR-NAV-3** | Web keyboard shortcuts (`/`, `Ctrl+K`) and URLs (`/search`) SHALL navigate to Search. | `App.tsx` | Implemented |

---

## 4. UI & Layout Specifications

### Header Architecture
- **Branding Block**:
  - Logo: `40x40`, radius `11`.
  - Brand Title: `FONTS.display`, size `rf(22)`, color `COLORS.text`.
  - Subtitle: `FONTS.bodyMedium`, size `rf(9.5)`, letter spacing `1.4`, color `COLORS.primary`.
- **Action Buttons**:
  - Search Button: `38x38`, borderless, icon size `19`.
  - Message Button: `38x38`, borderless, icon size `20`.
  - Avatar Button: `38x38`, radius `19`, border `1px` `COLORS.border`.
- **Floating Action Button (FAB)**:
  - Position: `position: 'absolute'`, `bottom: 12`, `right: 16`.
  - Shape: Pill with `paddingVertical: 11`, `paddingHorizontal: 18`, radius `RADIUS.full`.
  - Palette: Background `COLORS.primary`, text and icon `#ffffff`, elevation `6`.

---

## 5. Non-Functional & Reliability Highlights

1. **VirtualizedList Nesting Prevention**:
   - Resolved React Native warning (`VirtualizedLists should never be nested inside plain ScrollViews`) by using horizontal `ScrollView` for carousels and document slide previews within feed items.
2. **Gesture Isolation**:
   - `SwipeableDismissItem` requires horizontal movement (`dx < -10` and `|dx| > 1.5 * |dy|`) before acquiring gesture locks, preventing interference with vertical list scrolling.
3. **Native Driver Animation**:
   - `translateX` and `opacity` animations leverage `useNativeDriver: true` for zero-frame-drop 60fps/120fps performance on Android and iOS.
4. **Layout Continuity**:
   - Removal of dismissed cards uses React Native `LayoutAnimation.Presets.easeInEaseOut` for smooth upward transitions of surrounding cards.
5. **Deep Link Compatibility**:
   - Android App Links and iOS Universal Links resolve cleanly across tabs and root stacks.

---

## 6. Revision History

| Version | Date | Changes Summary |
|---|---|---|
| 1.0 | 2026-10-17 | Initial conceptual draft for community posting. |
| 1.4 | 2026-10-17 | Simplified posts to unified body-first format with optional hashtags. |
| 2.0 | 2026-10-17 | Updated to reflect all implemented features: multi-image carousels, document previews, inline native ads, user profile screen with social links, unified activity/inbox with slide-to-dismiss, embedded search in PYQ Home, and 4-tab navigation with floating action button (FAB). |
