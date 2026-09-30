# Changelog

All notable changes to PYQDeck are listed here, newest first.

## Unreleased

### Added
- **Continue where you left off.** Home shows a card that reopens the last question you were reading.

### Changed
- Content loads faster on launch: the app no longer waits for a server health check before its first request, and remembers which server worked last.
- Opening a subject now starts loading its papers immediately.
- Search, All Subjects and topic notes now use the shared cache: repeating a search is instant, a newer search cancels the older one, and the rate-limit wait follows the server's own timing.
- The notification prompt, update check and review prompt no longer appear during first-time onboarding.

## 1.0.4

### Fixed
- **Wrong solution shown for a question.** Question numbers such as "Q6" repeat across subjects, so opening Software Engineering Q6 could show the Web Technology Q6 solution. Solutions, saved questions and vote highlights are now stored per subject.
- Vote highlights no longer carry over between subjects that share a question number.
- Offline question search no longer mixes up questions from different subjects.

### Changed
- All question, solution, subject and syllabus data now goes through one shared cache (React Query), so screens reuse data they have already loaded instead of fetching it again.
- Solutions now refresh after 12 hours, so corrections and updated vote counts reach you. Before, a saved solution was never updated.
- Upvote and downvote counts on a saved solution update as soon as you vote.
- Syllabus is fetched fresh whenever you are online; the saved copy is only used when you are offline.
- Data you have viewed stays available offline for up to 30 days.
- "Clear cached data" in Settings now empties both the in-memory and saved cache.

### Notes
- On first launch after updating, old saved data and old vote highlights are cleared once. Everything reloads as you browse.

## 1.0.3

- Previous release.
