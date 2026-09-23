# AI citation navigation: stuck with no back button (fixed)

Date: 2026-09-23 · PR: #24 · File: `src/screens/SearchScreen.tsx` (`openAiReference`)

## Symptom (as reported on-device)

From Search → AI overview → tap a cited study note: the notes page opened,
but there was no way back — no header back button, and the Study tab itself
showed the notes page instead of the branch/semester home. Same class of
"stuck" report as the earlier search-navigation issue. Questions/papers cited
by the overview had the identical trap via the Browse tab.

## Root cause

`openAiReference` opened the server's canonical URL with `linkTo()`.
`linkTo` resolves through the *global* linking config, so a notes URL lands
in the **Syllabus tab's stack** (questions/papers in Browse's) — not in the
Search tab the user is standing on. When that stack wasn't mounted yet, the
target became its **root**: no back button rendered, and switching to the
Study tab showed the hijacked notes page instead of `SyllabusRoot`.

Rule of thumb this taught: `linkTo()` is for *incoming* deep links (cold
start, notifications). *In-app* taps must navigate inside the current stack.

## Fix (#24)

Known canonical paths are parsed and routed into the Search tab's own stack,
which already registers all three screens (see `SearchStack` in `App.tsx`):
push over the results, header back intact, Study tab untouched.

- `/syllabus/subject/:slug/topic/:id/:slug?` → `navigate('TopicNotes',
  { subjectId, topicId })` — bare ids; the TopicNotesScreen resolver fills
  in title/module, same as a deep link.
- `/:sem/:subject/:year/:qid` (4 segments, numeric year) →
  `navigate('QuestionDetail', …)`.
- `/:sem/:subject/:year` (3 segments, numeric year, not `syllabus`) →
  `navigate('QuestionList', …)`.
- Anything else (semester sheets, `/search`) still goes through `linkTo()`,
  because those stacks own those paths. Unknown paths fall back to the
  param-based `ref.navigate` handling, then give up silently.
- Regex, not `new URL()`: Hermes has no URL global.

## Checklist for future citation/deep-link work

1. Tapping a result must never leave the current tab unless the destination
   genuinely lives in another tab — and then use the
   `navigate('Tab', { screen, initial: false, params })` pattern (see
   `HomeScreen.openNote`), never a bare cross-tab push.
2. If the screen exists in the current stack, `navigate('<Screen>', params)`
   is always enough; verify registration in `App.tsx` first.
3. `linkTo()` stays reserved for external entry points.
4. After adding a route, open it from every entry point (card, sheet,
   notification, cold-start link) and confirm the back button returns
   somewhere sane.

## Verification

- `tsc --noEmit` clean.
- Manual on-device: Search → AI overview → cite a note → header back returns
  to results; Study tab still shows the branch picker.
