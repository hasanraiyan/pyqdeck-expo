# SRS: First-Time Question Reading Layout Choice & Storage Persistence

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Status | Approved for Implementation |
| Scope | `QuestionListScreen.tsx`, `SettingsScreen.tsx`, `src/utils/settings.ts` |

---

## 1. Context & Motivation

Users currently open the **Question List** screen in the default **Accordion** layout without being aware that a full **Open Cards** reading layout exists. 

Prior attempts to place permanent mode-switch controls (such as navigation header pills or sub-header strips) introduce UI clutter and cause native Android navigation bar flicker/layout thrashing.

### Solution:
When a user opens the Question List screen for the very first time, present a lightweight, elegant bottom sheet/dialog displaying **interactive visual sample previews of both UIs**:
- **Accordion (Compact)**: Tap to expand. Shows a visual mockup of compact rows with preview text, marks, and chevrons. Great for quickly scanning topics and jumping across modules.
- **Open Cards (Full View)**: Shows a visual mockup of an open card with question body, module strip, and details CTA. Great for continuous linear reading like an exam paper book.

Once the user selects their preference, it is saved in `AsyncStorage`. On all subsequent visits, their selected layout loads automatically without ever showing the prompt again. Users can still change their reading layout at any time in **Settings**.

---

## 2. Storage & State Contracts

### 2.1 AsyncStorage Keys

1. **`old_ui_enabled`**:
   - **Type**: `'1'` \| `'0'`
   - `'0'` = Accordion mode (default)
   - `'1'` = Open Cards mode
   - Owned by `getOldUiEnabled()` and `setOldUiEnabled(value: boolean)`.

2. **`question_layout_chosen`**:
   - **Type**: `'1'`
   - Written when the user confirms their layout in the first-time prompt, OR when they explicitly toggle the layout in `SettingsScreen`.
   - Read on `QuestionListScreen` mount to decide whether to show the prompt.

### 2.2 Contract Rules & Invariants
- **Rule 1 (Zero Re-prompting)**: If `question_layout_chosen === '1'`, the prompt modal must never display.
- **Rule 2 (Existing User Protection)**: If `old_ui_enabled` is already explicitly stored in `AsyncStorage` (from prior use in Settings), `hasChosenQuestionLayout()` must evaluate to `true` to avoid interrupting existing users.
- **Rule 3 (Atomic Sync)**: Confirming a layout writes both `old_ui_enabled` and `question_layout_chosen` to `AsyncStorage` and updates the active component state `isOldUi` immediately.
- **Rule 4 (Settings Parity)**: Toggling the layout in `SettingsScreen` automatically marks `question_layout_chosen = '1'` to prevent the prompt if the user visits Question List afterward.

---

## 3. Requirements Specification

| ID | Requirement | Pri | Status |
|---|---|---|---|
| **FR-LP1** | **First-Time Detection**: Upon entering `QuestionListScreen`, check `hasChosenQuestionLayout()`. If `false`, open the layout selection prompt. | **Must** | Open |
| **FR-LP2** | **Responsive Sheet / Modal**: Render the prompt using `useDialogLayout()` — bottom sheet on mobile, centered modal card on tablet/desktop. | **Must** | Open |
| **FR-LP3** | **Visual Sample Previews for Both UIs**: Each option card displays a realistic, beautifully rendered miniature preview of its layout:<br>• **Accordion Preview**: Shows compact stacked question items with question numbers, one-line text, marks badges, and collapse/expand chevrons.<br>• **Cards Preview**: Shows an open card with header meta, module tag, full question statement, and the exam-teal CTA button. | **Must** | Open |
| **FR-LP4** | **Instant Persistence**: Tapping "Continue" (or selecting a layout) persists `old_ui_enabled` and `question_layout_chosen` to `AsyncStorage`, updates `isOldUi`, and smoothly closes the modal. | **Must** | Open |
| **FR-LP5** | **Zero UI Clutter**: No permanent sub-header strip, no toolbar, and no header segmented buttons on `QuestionListScreen`. | **Must** | Open |
| **FR-LP6** | **Settings Screen Sync**: Toggling layout in `SettingsScreen.tsx` also persists `question_layout_chosen = '1'`. | **Should** | Open |

---

## 4. UI / UX Design Specification

### Modal Dialog with Visual Sample Previews
```
┌────────────────────────────────────────────────────────┐
│                        ─────                           │ <-- Drag handle
│  Choose Your Reading Layout                            │
│  Select how you'd like to browse question papers:      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ (•) Accordion (Compact)                          │  │
│  │     Tap to expand questions. Great for scanning. │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ 1. Explain Dijkstra's algorithm... [5M] ⌄  │  │  │ <-- Miniature
│  │  │ 2. Compare TCP vs UDP protocol...  [4M] ⌄  │  │  │     Accordion Sample
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ( ) Open Cards (Full View)                       │  │
│  │     Questions always open for continuous reading.│  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ [2024]                                [5M] │  │  │ <-- Miniature
│  │  │ MODULE 1 · NETWORKS                        │  │  │     Card Sample
│  │  │ Explain Dijkstra's shortest path algorithm.│  │  │
│  │  │ [ ✓ Solution Available — View Details → ]  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  You can change this anytime in Settings.              │
│                                                        │
│  [                  Continue                      ]    │
└────────────────────────────────────────────────────────┘
```

- **Interactive Selection**: Tapping either container selects it with immediate visual radio feedback and subtle border highlight (`borderColor: COLORS.primary` or `COLORS.secondary`).
- **Micro-Interactions**: Light haptic feedback (`Haptics.selectionAsync()`) on option change and confirmation.
- **Sample UI Fidelity**: Mini mockups accurately reflect real typography (`FONTS.mono`), real badge styling, and real color tokens (`COLORS.background`, `COLORS.cardSecondary`, `COLORS.secondary`).

---

## 5. Non-Functional Requirements (NFRs)

- **NFR-1 Zero Flicker**: No elements added or removed from the native navigation header, completely avoiding Android toolbar layout jumps.
- **NFR-2 Non-Blocking Resolution**: Asynchronous storage read completes without delaying the questions query or FlatList rendering.
- **NFR-3 Graceful Error Handling**: If storage encounters an error, default safely to Accordion mode without crashing or permanently re-prompting.
