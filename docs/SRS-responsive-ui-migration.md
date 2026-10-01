# SRS: Responsive UI Migration (phone, tablet, laptop, desktop)

| Field | Value |
|---|---|
| Document | Software Requirements Specification (repo copy) |
| Status | Approved. Phases 0 to 4 implemented. Remaining: device QA with the real backend and Clerk |
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
| FR-N8 | Search shortcut (`/`, Ctrl/Cmd+K) | C | Done (`App.tsx`; ignored while typing or in a dialog) |
| FR-L1 | Shared `ScreenContainer` | M | Done; used by Home, SubjectDetail, Settings, Search, plus `useContainerStyle` on the four Study screens |
| FR-L2 | Shared `ResponsiveGrid` (pure logic in `layout.ts`) | M | Done; Home and SubjectDetail year grids. AllSubjects and SubjectList FlatLists use measured-width `getGridColumns` |
| FR-L3 | List-detail for Browse | M | Done as a list pane inside `QuestionDetailScreen` (the paper's questions beside the open one) when its own box is >= 800 px. Keeps stack, deep links and back button |
| FR-L4 | List-detail for Study | S | Done as a topic pane inside `TopicNotesScreen` (topics grouped by module, open one highlighted and scrolled into view), same pattern as Browse |
| FR-L5 | List-detail for Search | S | Done for question hits: results stay on the left, the selected question's full text is previewed on the right (`QuestionPreviewPane`) with Open full question / Open subject. Subjects and study notes have no preview and still navigate |
| FR-L6 | Narrow windows get one pane | M | Done (pane is measured, so tablet portrait and phone stay single-pane) |
| FR-L7 | Prose capped at `readMaxWidth` | M | Existing on 9 screens |
| FR-L8 | Selected row highlighted in list-detail | M | Done |
| FR-L9 | Sheets as centred dialogs on laptop+ | S | Done for the four in-app sheets (filter, two report sheets, AI sources) via `useDialogLayout`. The Clerk sign-in and account screens are full-screen route presentations and are unchanged |
| FR-C1 | `compact` density | S | Done for cards and rows: `useResponsive().compact` (laptop and up) tightens Search result cards and the `QuestionItem` header (`compact` prop, defaults to the window class). Chips and badges are unchanged; touch sizes on phone and tablet are never reduced |
| FR-C2 | Hover, focus-visible, pressed on web/desktop | M | Done by one stylesheet (`webStyles.ts`) covering every focusable element, plus hover on the new sidebar and list-pane rows |
| FR-C3 | Skeletons match final layout | S | Done for SubjectList and AllSubjects; the Study skeletons were already fluid |
| FR-C4 | Reflow by container width | M | Done for `QuestionItem` (measured). `AiOverviewCard` never used window width |
| FR-C5 | Math, code, images fit the reading column | M | Verified by code review only: code scrolls horizontally, math and content are width 100% |
| FR-C6 | Ad placement | M | Banner stays under the detail pane, not in the reading column; policy unchanged. Not checked with a live ad |
| FR-C7 | State screens centred, max 420 px | S | Done (`ScreenError`) |
| FR-R1 | Scaling helpers do not use import-time `Dimensions` | M | Done for `scale` / `verticalScale`; `rf()` is still evaluated when a `StyleSheet` is created |
| FR-R2 | Onboarding follows live window width, capped width | M | Done |
| FR-R3 | Rotation/resize without remount or refetch | M | Verify per phase |
| FR-R4 | Remove legacy `contentMaxWidth`, `gridColumns`, `MAX_CONTENT_WIDTH` | S | Done |
| FR-R5 | Dev breakpoint overlay | C | Done (breakpoint and width in the dev backend banner) |

## 4. Non-functional
Phone UI unchanged (NFR-1); no new native dependency and no release workflow change (NFR-7, NFR-8); layout logic is pure and unit tested (`npm test`); verify at 360, 768, 1024, 1280 and 1920 px.

## 5. Phases
0. Foundations: breakpoint consolidation, tokens, pure layout logic with tests, stale `Dimensions` fixes. **Done.**
1. Navigation shell using `tabBarPosition` / `tabBarVariant` (React Navigation 7.19). **Done** except FR-N4 to N8.
2. `ScreenContainer`, `ResponsiveGrid`, screen migration. **Done** (QuestionList keeps its own `readMaxWidth` cap): all screens now use `ScreenContainer` / `useContainerStyle` / `ResponsiveGrid`, or measured-width `getGridColumns`.
3. Master-detail. **Done.** Browse and Study use a simpler design than the nested navigator first proposed: the detail screen shows its list beside it, so URLs, deep links and back behave unchanged. Search shows a preview pane for question hits.
4. Hover/focus/keyboard, dialog modals, skeleton parity, state screens, dev overlay. **Done** except device QA.

## 6. Open questions
- Should the sidebar start collapsed by default on laptop widths? (Today it starts expanded.)
- Wide-window ad format: leaderboard banner or today's banner?
- Is Study master-detail (FR-L4) required in the first release?
