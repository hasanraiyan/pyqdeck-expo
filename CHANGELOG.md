# Changelog

All notable changes to PYQDeck are listed here, newest first.

## 1.12.4

### Added
- **Share a diagram as a picture.** Open any diagram or flowchart in the zoom view and tap the new share button at the top. The diagram is turned into an image that you can send to friends or save from the share menu. While it is being made, a step-by-step progress bar shows what is happening.

## 1.12.3

### Changed
- **The next note opens straight away.** While you read a note, the next topic's note loads quietly in the background, so tapping Next no longer waits for a download.
- **The app has less to load when it opens.** The tools that draw formulas and colour code in notes now load only when a note needs them, instead of every time the app starts. The same goes for the admin screens, and the first screen no longer waits for the two handwriting fonts used by note diagrams.

## 1.12.2

### Changed
- **Study notes open much more smoothly.** The text now appears from the top in small pieces, then the diagrams and formulas are drawn one at a time, top to bottom. Before, the whole screen could freeze or turn white for a few seconds on long notes with big diagrams.
- **A new loading animation for diagrams.** While a diagram or flowchart is getting ready, you see a grid of softly twinkling dots instead of a spinner, and the diagram fades in when it is done.

### Fixed
- Big hand-drawn diagrams in the notes (the ones with a wobbly pen effect) no longer slow the phone to a crawl. They now draw with clean straight lines.
- Some diagrams, like the Wireless LANs one, did not show at all because of a "less than" sign in their text. They show now.

## 1.12.0

### Added (admins)
- **Edit questions and solutions in the app.** Add a question to a subject, edit or delete it, and add, edit or delete its solution, all from the question screens. Past-paper subjects can be added, renamed and deleted too.
- **Drafts are kept.** Text you are writing in the notes, question and solution editors is saved on the phone as you type, so a crash or a dropped connection no longer loses it. You are offered Restore or Discard the next time you open the editor.
- The audit log can be filtered to question and subject changes.

### Changed (admins)
- **A new editor layout.** The topic, module, subject, notes, question and solution editors share one design: the Save and Delete buttons stay above the keyboard, Return moves to the next field, and closing with unsaved changes asks first.
- The notes editor fills the screen, and the formatting buttons insert at the cursor (or wrap the selected text) instead of at the end.

### Fixed
- After an admin saves a change, it now shows up straight away instead of hours later. The server also clears the other server and the Cloudflare cache after every admin save, so students see the change within seconds.

## 1.10.0

### Added
- **Scan a question to search.** Tap the camera icon in Search, take a photo or pick an image, crop it to the question, and the app reads the text on your phone and searches it. Nothing is uploaded, and the photo stays on your device.
- **Matched words are highlighted** in search results, so you can see why each question, note or subject came up.
- Recent searches that came from a scan show a camera icon, and long searches are shortened to two lines.

### Changed
- Long searches, like a whole scanned question, now find study notes and subjects too. Before, they only found questions.
- The scanner uses the system photo picker, so the app no longer needs access to your whole photo gallery.
- Search accepts questions up to 200 characters (it was 100).

### Fixed
- Uploading original question papers (for admins) is more reliable: pages are scaled down before they are sent, so large camera photos no longer trip the size limit.

## 1.1.0 to 1.9.0

These releases shipped close together; this is the combined list of what changed since 1.0.5.

### Added
- **Sign in to keep your progress.** Your syllabus progress, reading settings, selected branch, saved votes and "Jump back in" list now sync across your devices.
- **Original question papers.** View the scanned original paper for a year, unlocked by watching a short ad.
- **Study notes** can be voted on, reported and shared, and open full screen for distraction-free reading.
- **Richer notes.** Notes can now show highlighted callouts, tabbed code in several languages, step-by-step timelines, "hint" sections that expand, SVG and Mermaid diagrams, YouTube videos with timestamps, and image galleries with a full-screen viewer.
- **Topic questions.** Syllabus topics show a PYQ icon that opens the previous-year questions for that topic.
- Home shows what you read recently, and your profile picture once you sign in.

### Changed
- The bottom tab bar hides on detail screens so there is more room to read.
- A sign-in reminder appears in the banner area when you are not signed in.

### Fixed
- The "Clear cached data" setting now removes only downloaded content, not your account data.
- The AI overview no longer drops its "generating" message too early.
- Several layout and spacing fixes on Home, Study and notes screens.

## 1.0.5

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
