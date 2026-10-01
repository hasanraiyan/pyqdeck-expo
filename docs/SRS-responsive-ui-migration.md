# SRS: Responsive UI Migration (phone, tablet, laptop, desktop)

| Field | Value |
|---|---|
| Document | Software Requirements Specification (repo copy) |
| Status | Approved. Phases 0 to 2 implemented, Phase 3 partly (Browse), Phase 4 pending |
| Full document | The claude.ai doc "PYQDeck Responsive UI Migration - SRS" holds the long form, including the gap audit, research notes, feasibility table and risks. This file keeps what code needs to reference |

## 1. Goals
- G1 Navigation fits the window: bottom bar on phone, left rail on tablet, labelled sidebar from laptop.
- G2 Wide windows use master-detail panes where it helps (browse, then read).
- G3 Reading lines stay at about 45 to 80 characters at any width.
- G4 One breakpoint model and one layout toolkit for every screen.
- G5 Phones (below 600 px) do not change.

Out of scope: dark mode, backend changes, native code, new features. Web is a dev and QA target, not a shipped product.

## 2. Breakpoint model
Window width only (BP-1). Source of truth: `src/theme/layout.ts`.

| Attribute | Phone (<600) | Tablet (600-1023) | Laptop (1024-1439) | Desktop (1440+) |
|---|---|---|---|---|
| Shell | Bottom tab bar | Left rail, 72 px | Left sidebar, 240 px | Left sidebar, 240 px |
| Panes | One | One (two when each pane fits, BP-4) | Two: list + detail | Two (+ optional third) |
| Grid max width | 720 | 900 | 1100 | 1240 |
| Reading column | 720 | 680 | 720 | 760 |
| Gutter | 16 | 24 | 32 | 40 |

Rules: BP-2 crossing a threshold keeps navigation state; BP-3 grid columns come from the measured container width; BP-4 two panes only when list >= 320 px and detail >= 480 px fit beside the shell; BP-5 values live in the token file.

## 3. Requirements and status

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-N1 | Bottom bar / rail / sidebar by window class | M | Done (`App.tsx` `TabsNavigator`) |
| FR-N2 | Same destinations in every shell | M | Done |
| FR-N3 | Tab stack state kept on switch | M | Done (unchanged tab navigator) |
| FR-N4 | Logo, Settings and account slots in the sidebar | M | Done (`ShellTabBar`). Account item shows only when Clerk loads; not verified here |
| FR-N5 | Collapsible sidebar, remembered | S | Done (`ShellTabBar`, persisted in AsyncStorage) |
| FR-N6 | Back control, browser/OS back, Escape | M | Done (header back arrow, router history on web, Escape handler in `App.tsx`) |
| FR-N7 | URL and deep links identical at every width | M | Verify per phase (config untouched so far) |
| FR-N8 | Search shortcut (`/`, Ctrl/Cmd+K) | C | Pending |
| FR-L1 | Shared `ScreenContainer` | M | Done; used by Home, SubjectDetail, Settings, Search, plus `useContainerStyle` on the four Study screens |
| FR-L2 | Shared `ResponsiveGrid` (pure logic in `layout.ts`) | M | Done; Home and SubjectDetail year grids. AllSubjects and SubjectList FlatLists use measured-width `getGridColumns` |
| FR-L3 | List-detail for Browse | M | Done as a list pane inside `QuestionDetailScreen` (the paper's questions beside the open one) when its own box is >= 800 px. Keeps stack, deep links and back button |
| FR-L4, FR-L5 | List-detail for Study and Search | S | Pending |
| FR-L6 | Narrow windows get one pane | M | Done (pane is measured, so tablet portrait and phone stay single-pane) |
| FR-L7 | Prose capped at `readMaxWidth` | M | Existing on 9 screens |
| FR-L8 | Selected row highlighted in list-detail | M | Done |
| FR-L9 | Auth/onboarding modals as centred dialog on laptop+ | S | Pending (Phase 4) |
| FR-C1..C7 | Density, hover/focus, skeleton parity, container-width reflow, ads placement, state centring | M/S | Pending (Phase 4) |
| FR-R1 | Scaling helpers do not use import-time `Dimensions` | M | Done for `scale` / `verticalScale`; `rf()` is still evaluated when a `StyleSheet` is created |
| FR-R2 | Onboarding follows live window width, capped width | M | Done |
| FR-R3 | Rotation/resize without remount or refetch | M | Verify per phase |
| FR-R4 | Remove legacy `contentMaxWidth`, `gridColumns`, `MAX_CONTENT_WIDTH` | S | Done |
| FR-R5 | Dev breakpoint overlay | C | Pending |

## 4. Non-functional
Phone UI unchanged (NFR-1); no new native dependency and no release workflow change (NFR-7, NFR-8); layout logic is pure and unit tested (`npm test`); verify at 360, 768, 1024, 1280 and 1920 px.

## 5. Phases
0. Foundations: breakpoint consolidation, tokens, pure layout logic with tests, stale `Dimensions` fixes. **Done.**
1. Navigation shell using `tabBarPosition` / `tabBarVariant` (React Navigation 7.19). **Done** except FR-N4 to N8.
2. `ScreenContainer`, `ResponsiveGrid`, screen migration. **Done** (QuestionList keeps its own `readMaxWidth` cap): all screens now use `ScreenContainer` / `useContainerStyle` / `ResponsiveGrid`, or measured-width `getGridColumns`.
3. Master-detail. **Browse done** with a simpler design than the nested navigator first proposed: the detail screen shows the paper's question list beside it, so URLs, deep links and back behave unchanged. Study and Search pending.
4. Hover/focus/keyboard, dialog modals, density, ads placement, QA. Pending.

## 6. Open questions
- Should the sidebar start collapsed by default on laptop widths? (Today it starts expanded.)
- Wide-window ad format: leaderboard banner or today's banner?
- Is Study master-detail (FR-L4) required in the first release?
