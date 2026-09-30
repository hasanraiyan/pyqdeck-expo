# Changelog

All notable changes to PYQDeck are listed here, newest first.

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
