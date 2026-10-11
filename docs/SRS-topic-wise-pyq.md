# SRS: Topic-wise Past Papers (connecting the Study tab and the PYQ tab)

Structured after IEEE Std 830-1998. Builds on `SRS-pyqdeck-app.md`, `SRS-admin-features.md` and `SRS-admin-in-app.md`.

| Field | Value |
|---|---|
| Product | PyQdeck Android app, the backend API, and the admin tools (MCP and in-app) |
| Feature | A "PYQ" icon on each syllabus topic that opens only that topic's past-paper questions; a question may belong to several topics |
| Document version | 1.0 (draft for review) |
| Date | 2026-10-12 |
| Status | Requirement analysis and plan. No code written. Section 9 lists the decisions needed before Phase 1. |
| Evidence | Verified against server `main` and the live database (read-only counts) on 2026-10-12. |

---

## 1. Introduction

### 1.1 Purpose
A student opening a subject in the Study tab sees topics with a video icon and notes. They cannot see which past-paper questions were asked on that topic. Past papers live in the PYQ tab, grouped only by subject and by a module-level "chapter". This SRS defines how to connect the two, down to the topic, for students and for the admins who must create and maintain the links.

### 1.2 Scope
In scope: a topic-to-question link, student screens (topic icon, topic question list, topic chips on a question, a way back), admin tools to create and review links (MCP, REST, in-app), AI-assisted suggestions with human confirmation, coverage reporting, and the data preparation the feature depends on.
Out of scope: changing how questions are stored or searched today, per-question progress tracking ("solved" ticks), a new question editor, iOS, and the website (it can adopt the same API later).

### 1.3 Definitions
| Term | Meaning |
|---|---|
| PYQ subject | A subject in the past-paper archive (`Subject`, slug such as `sem6_computer_networks`). Questions belong to it. |
| Syllabus subject | A subject in the syllabus (`SyllabusSubject`, slug such as `cse6-computer-networks`) with modules and topics. Branches have their own. |
| Topic | A topic inside a syllabus subject's module (stable Mongo `_id`; ids are preserved on syllabus edits). |
| Chapter | The existing free-text label on a question, for example "Module 2: Data Link Layer & MAC Sublayer". Module-level only. |
| Topic link | A stored fact: "this question is about this topic". Many topics per question, many questions per topic. |
| Suggestion | A link proposed by software and not yet confirmed by a person. |

### 1.4 Current state (verified)

| Area | Fact | Source |
|---|---|---|
| Question model | One free-text `chapter` string per question (default `Uncategorized`), `subject` (PYQ subject), `year`, `marks`, `type`. No topic field. | `models/Question.js` |
| Scale | 3,203 questions across 40 PYQ subjects (39 have questions). 67 questions are `Uncategorized`. | live DB |
| Chapter naming | Chapters are numbered labels written when the questions were entered ("Module 2: Data Link Layer & MAC Sublayer"). They do **not** match the syllabus module titles ("Data Link Layer and Medium Access Sub Layer") and the counts differ (Computer Networks: 5 chapters vs 6 syllabus modules for CSE and 5 for IT). | live DB |
| Syllabus size | 46 syllabus subjects; modules and topics embedded with stable ids. | live DB, `models/SyllabusSubject.js` |
| The existing bridge | `SyllabusSubject.pyqSubjectId` holds a PYQ subject slug. **Only 2 of 46** syllabus subjects have it set, and both (CSE and IT Computer Networks) point to the **same** PYQ subject. | live DB |
| Shared subjects | One PYQ subject can serve several syllabus subjects (different branches, different topic lists). | live DB |
| App, Study side | The subject screen opens topic notes only; it never reads `pyqSubjectId`. | `SubjectSyllabusScreen.tsx` |
| App, PYQ side | The subject screen opens the question list by chapter only; it has no link to the syllabus. | `SubjectDetailScreen.tsx` |
| Admin tools | `manage_content` edits questions; `manage_syllabus` edits topics; nothing links them. | `mcp/adminMcpServer.js` |
| Reusable pieces | Question list and detail screens with filters, an embeddings pipeline (Qdrant) used for question search, an admin audit log, in-app admin screens, topic id preservation. | server and app |

Consequence: the connection has to be built from the data up. Even with perfect screens, 44 of 46 syllabus subjects have no PYQ subject to point at, and no question knows its topic.

---

## 2. Requirement analysis

### 2.1 Stakeholders and what each needs

| Stakeholder | Need | Pain today |
|---|---|---|
| **Student revising a topic** | "Show me the questions asked on exactly this topic", ideally with how often it came and whether a solution exists. | Must leave the tab, find the subject in the PYQ tab, guess the right module chapter, scroll. |
| **Student with a past paper in hand** | "Which topic is this question from?" so they can read the notes. | The question shows only a module label; no way to the notes. |
| **Student near exams** | "What is asked most?" to prioritise topics. | No frequency information. |
| **Admin / content editor** | Link questions to topics quickly and correctly, see what is unlinked, review suggestions, fix mistakes. | No tool; 3,203 questions across about 1,500 topics is too much to link by hand without help. |
| **Product owner** | Know coverage (how much is linked), and which subjects are ready to show. | No visibility. |
| **System / operations** | Fast reads, safe edits, caches that do not serve stale links for long. | Public GET responses are edge-cached for an hour; admin edits need a purge path. |

### 2.2 The hard parts (and how the design answers them)

| Problem | Why it is hard | Answer in this SRS |
|---|---|---|
| A question can belong to several topics | A single `topic` field cannot hold it; the same question must appear under each. | Many-to-many **topic link** records (section 4.1). Lists de-duplicate; counts are distinct questions. |
| Questions belong to a PYQ subject, topics to a syllabus subject, and one PYQ subject serves several syllabus subjects | A link must say which syllabus the topic belongs to; CSE and IT topic lists differ. | Each link stores the syllabus subject and topic. A question can be linked independently in each syllabus it is relevant to. |
| Only 2 of 46 subjects are bridged | Everything else depends on this. | Phase 0 data preparation: an admin tool to map PYQ subject to syllabus subject(s), with name and code suggestions. |
| Chapters do not match modules | A one-to-one derive is impossible. | Chapters stay as they are; topics are linked separately. A chapter can still **hint** at the module for suggestions. |
| Volume | About 3,200 questions, avg 2 topics each. | AI-assisted suggestions (embeddings plus topic titles and notes), **always confirmed by a person**; bulk import for work done offline. |
| Quality | A wrong link sends a student to the wrong topic. | Link status (suggested, confirmed, rejected), reviewer identity, audit log, a "report wrong topic" path for students (phase 4), coverage and disagreement reports. |
| Cache staleness | Public reads are cached up to an hour at the edge. | Link edits trigger the existing cache clear; counts have a short TTL. |

### 2.3 What students should see (target behaviour)

1. **Study tab, subject screen:** each topic row gets a **PYQ icon with a count** (for example "12") next to the video and notes icons. It appears only when the topic has at least one confirmed question. Module rows show a combined count (distinct questions).
2. **Tap the icon:** a list of that topic's questions: year, marks, "has solution" badge, the other topics a question also covers, filters for year and solved-only, newest first. Opening a question uses the existing detail screen, with previous/next inside the topic list.
3. **Question detail:** topic chips ("Topics: Subnetting, IP addressing"). Tapping a chip opens that topic's notes. A "Study this topic" button on the main topic.
4. **PYQ tab:** subject screen gets "Syllabus and notes" (when a syllabus subject is mapped), so the connection works in both directions.
5. **Frequency:** per topic "Asked in N papers (years)" on the topic's PYQ list header, from the links.
6. Everything works from the persisted cache offline, as the rest of the app does.

### 2.4 What admins need (target behaviour)

1. **Map subjects:** for each syllabus subject, choose its PYQ subject (many syllabus subjects may share one). Suggestions by name and code; one tool call or screen action.
2. **Link questions:** pick a question (or a batch), choose one or more topics from that syllabus subject, save. Replace, add and remove are separate actions.
3. **Bulk import:** a file or JSON of `questionId -> topic titles or ids` for work prepared elsewhere; a dry run reports unmatched titles before anything is written.
4. **Suggestions:** run the classifier for a subject; review a queue sorted by confidence; accept, change or reject. Nothing student-visible changes until confirmed.
5. **Coverage:** per subject, how many questions are linked, how many topics have no questions, how many suggestions wait, how many were rejected.
6. **Safety:** every write is audited with the same guard as the other admin tools; destructive bulk actions need `confirm`; grants can restrict who may link.
7. **In-app workbench** (phase 4): the same on a phone: pick a subject, see unlinked questions, tap topic chips, save.

---

## 3. Overall description

### 3.1 Design in one paragraph
Add a **topic link** collection (question, syllabus subject, topic, status, source, confidence). The server exposes public read endpoints (counts per subject, questions per topic, topics per question) and admin write endpoints (set, add, remove, bulk, suggest, review, coverage) through the existing guard so grants and audit apply. The app adds the PYQ icon, a topic question list (reusing the question list screen with a topic filter), topic chips on the question detail, and the reverse link in the PYQ tab. A Phase 0 mapping job connects PYQ subjects to syllabus subjects, and a suggestion pipeline reuses the embeddings already built for search so people confirm rather than type.

### 3.2 Constraints
- CR-1: Existing endpoints and the module-wise chapter filter keep working unchanged; everything is additive.
- CR-2: Students only ever see **confirmed** links. Suggestions and rejected links are admin-only.
- CR-3: No new paid service. The classifier uses the existing embeddings API and the existing vector store.
- CR-4: Admin actions use the shared grant and audit guard (`mcp/adminGuard.js`).
- CR-5: Works on both server origins and one MongoDB.
- CR-6: Topic ids are the stable ids already preserved across syllabus edits; links must survive a subject slug change.

### 3.3 Assumptions
- A1: Students benefit even at partial coverage, so the icon appears per topic only when it has questions; subjects roll out as they are finished.
- A2: The existing embeddings pipeline can embed topic titles and note text well enough to rank candidate topics; quality is checked in a pilot (phase 2) before scaling.
- A3: Reviewers are a small team; review speed, not classification speed, limits the rollout.

---

## 4. Data requirements

### 4.1 Topic link

| Field | Notes |
|---|---|
| `question` | ObjectId of the question |
| `syllabusSubject` | ObjectId of the syllabus subject the topic belongs to |
| `moduleId`, `topicId` | strings, the syllabus subdocument ids |
| `status` | `suggested`, `confirmed` or `rejected` |
| `source` | `manual`, `import` or `suggested` |
| `confidence` | 0 to 1 for suggestions, else empty |
| `reviewedBy`, `reviewedAt` | admin id and time for confirmed or rejected links |
| timestamps | created and updated |

| ID | Requirement | Priority |
|---|---|---|
| TQ-DR-1 | A unique index on `(question, syllabusSubject, topicId)` so one question cannot be linked to the same topic twice. | M |
| TQ-DR-2 | Indexes for the reads: by `(topicId, status)` and by `(question, status)`, and by `(syllabusSubject, status)` for counts and coverage. | M |
| TQ-DR-3 | A question may have at most 8 confirmed topic links per syllabus subject (a typical exam question spans one to three). Over the cap is rejected with a clear message. | S |
| TQ-DR-4 | A link whose topic no longer exists is hidden from students and listed in coverage as orphaned; it is removed after 180 days. | S |
| TQ-DR-5 | Deleting a question deletes its links. Deleting a student's account does not touch links (no personal data). | M |

### 4.2 Subject mapping

| ID | Requirement | Priority |
|---|---|---|
| TQ-DR-6 | Keep `SyllabusSubject.pyqSubjectId` as the mapping (a PYQ subject may be referenced by several syllabus subjects). Validate it against the PYQ subject slugs on write. | M |
| TQ-DR-7 | Phase 0 fills the mapping for every syllabus subject that has past papers, and leaves the rest empty. | M |

---

## 5. Specific requirements

### 5.1 Server: public reads (students)

| ID | Requirement | Priority |
|---|---|---|
| TQ-FR-1 | `GET /api/public/syllabus/subjects/:subject/topic-questions/counts` returns `{ topics: { <topicId>: n }, modules: { <moduleId>: n }, total }` counting **distinct** confirmed questions. One request per subject screen. | M |
| TQ-FR-2 | `GET /api/public/syllabus/subjects/:subject/topics/:topic/questions` returns that topic's confirmed questions with year, marks, `isAnswerAvailable`, the question's other topics (id and title), and the question's PYQ subject id; filters `year`, `hasSolution`; paging with the same `limit` and `offset` rules as other lists; newest year first. | M |
| TQ-FR-3 | Question detail gains an additive `topics: [{ syllabusSubject, moduleId, topicId, title }]` (confirmed only) so the app can draw chips. Older apps ignore it. | M |
| TQ-FR-4 | `GET .../topics/:topic/questions/summary` returns `{ count, years: [{year, count}], withSolution }` for the "asked N times" header. May be folded into TQ-FR-2's first page. | S |
| TQ-FR-5 | `GET /api/public/subjects/:subject/syllabus` returns the syllabus subject(s) mapped to a PYQ subject (slug, name, branches) for the reverse link. | M |
| TQ-FR-6 | These GETs are public and cacheable (short edge TTL, 5 minutes, because edits happen); the admin cache clear also purges them. Responses never include suggested or rejected links. | M |

### 5.2 App: students

| ID | Requirement | Priority |
|---|---|---|
| TQ-FR-7 | Subject syllabus screen fetches the counts once (TQ-FR-1) and shows a **PYQ icon with the count** on each topic that has questions, and a combined count on each module. Topics with none show no icon. | M |
| TQ-FR-8 | Tapping the icon opens **Topic questions**: header with topic name, count, years asked; filter chips for year and "with solution"; each row like the existing question row plus small chips for the question's other topics. | M |
| TQ-FR-9 | Opening a question from this list uses the existing detail screen with prev/next limited to the topic's list, and a back path to the list. | M |
| TQ-FR-10 | Question detail shows **topic chips**; a chip opens that topic's notes. The main chip is the topic the student came from. | M |
| TQ-FR-11 | The PYQ subject screen shows **Syllabus and notes** when a syllabus subject is mapped; with several (different branches) it asks which, preselecting the student's saved branch. | S |
| TQ-FR-12 | Counts and lists are cached and persisted like the rest of the app, so they work offline after first view; pull to refresh; a missing or failed counts call simply hides the icons, never an error screen. | M |
| TQ-FR-13 | The existing module-wise chapter filter and its screens are unchanged. | M |
| TQ-FR-14 | Analytics events count icon taps and topic lists opened, without user identifiers. | S |

### 5.3 Server: admin writes (MCP tool, REST, audit)

New admin tool `manage_topic_links` (actions listed here), exposed through the admin MCP and `/api/admin-app`, using the shared guard.

| ID | Requirement | Priority |
|---|---|---|
| TQ-AD-1 | `map_subject`: set or clear `pyqSubjectId` for a syllabus subject, chosen by an admin. **Nothing is mapped automatically** (decision D11). | M |
| TQ-AD-2 | `set`: for one question and one syllabus subject, replace its confirmed topics with the given list (ids or exact titles). `add` and `remove` change single links. All enforce TQ-DR-1 and TQ-DR-3. | M |
| TQ-AD-3 | `bulk`: apply an array of `{ question, topics }` (question by `subject` plus `questionId`, topics by id or title). `dryRun` returns counts of matched, unmatched titles and rows that would change; `confirm: true` writes. Capped at 500 rows per call. | M |
| TQ-AD-4 | `list_unlinked`: questions of a PYQ subject with no confirmed link, filterable by chapter and year, paged. | M |
| TQ-AD-5 | `suggest`: for a PYQ subject and syllabus subject, compute suggestions (section 5.4) and store them as `suggested`. `review_queue` lists them by confidence; `review` confirms, changes or rejects a set. | M |
| TQ-AD-6 | `coverage`: per syllabus subject, questions total, linked, unlinked, pending suggestions, rejected; topics with no question; orphaned links. | M |
| TQ-AD-7 | `unlink_all` for a topic or a subject needs `confirm: true`. | S |
| TQ-AD-8 | Every write is audited by the shared guard (tool, action, target, counts), never the question text. | M |
| TQ-AD-9 | Grants: `manage_topic_links` honours `actions`, so a reviewer can be given `list_unlinked`, `set`, `review_queue` and `review` only; `bulk` and `unlink_all` stay with full admins. | M |
| TQ-AD-10 | After any write the topic-link caches and the public edge cache for the affected subject are invalidated through the existing cache-clear path. | M |

### 5.4 Suggestion pipeline (AI-assisted, human confirmed)

| ID | Requirement | Priority |
|---|---|---|
| TQ-SG-1 | For each question, rank the topics of the target syllabus subject by embedding similarity between the question text and each topic (title plus notes text when present), using the existing embeddings service and vector store. | M |
| TQ-SG-2 | The chapter label biases the ranking toward the matching module when a module can be inferred (by number or fuzzy title), but never excludes other modules. | S |
| TQ-SG-3 | Store the top 3 candidates above a minimum score as `suggested` with their score. Re-running replaces earlier unreviewed suggestions and never touches confirmed or rejected ones. | M |
| TQ-SG-4 | A rejected suggestion is not proposed again for the same question and topic. | M |
| TQ-SG-5 | A pilot on the Computer Networks pair (about 220 questions) measures how often the top suggestion is accepted unchanged; scale-up proceeds only if acceptance is high enough (decision D5). | M |
| TQ-SG-6 | The job runs on demand per subject (admin tool or screen), not on a schedule, and reports progress and cost-relevant counts. | S |

### 5.5 Admin in the app (phase 4)

| ID | Requirement | Priority |
|---|---|---|
| TQ-AA-1 | Admin tools gets **Topic links** with: subject mapping, coverage dashboard, the linking workbench, and the review queue. Shown only to accounts granted `manage_topic_links`. | S |
| TQ-AA-2 | Workbench: pick a PYQ subject and syllabus subject, step through unlinked questions, tap topic chips (searchable list of the subject's topics) to select several, save and move to the next. | S |
| TQ-AA-3 | Review queue: one suggestion at a time with the question text, the proposed topics and scores; accept, edit or reject; undo the last action. | S |
| TQ-AA-4 | Every screen follows the shared admin design system and the confirmation rules of `SRS-admin-in-app.md`. | M |

### 5.6 Student feedback (phase 5, optional)

| ID | Requirement | Priority |
|---|---|---|
| TQ-FB-1 | On the question detail, "Wrong topic?" lets a signed-in student report a link; reports appear in the admin review queue and never change the link automatically. | C |

---

## 6. Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| TQ-NFR-1 | Counts request: under 300 ms server time for any subject; topic question list page of 20: under 300 ms. | S |
| TQ-NFR-2 | The student screens add at most one extra request per subject screen (the counts); the list loads only on tap. | M |
| TQ-NFR-3 | Reads are served from indexes; no collection scan on a student request. | M |
| TQ-NFR-4 | Backwards compatible: older apps are unaffected; the new fields and endpoints are additive. | M |
| TQ-NFR-5 | Tests: link uniqueness and cap, many-to-many reads with de-duplication, confirmed-only visibility, grants per action, audit entries, bulk dry run, suggestion re-run semantics, cache invalidation, id preservation after a syllabus edit, and the app's pure logic (icon visibility, counts roll-up, list filtering) under `node --test`. | M |
| TQ-NFR-5a | `tsc` stays clean; new admin screens follow the existing component kit. | M |
| TQ-NFR-6 | Privacy: links hold no personal data; admin output follows the existing rules (no tokens, no emails in audit). | M |

---

## 7. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| T1 | A topic has 12 confirmed questions | Study tab shows a PYQ icon with "12"; tapping lists exactly those 12, newest year first. |
| T2 | One question is linked to two topics | It appears under both; each topic's count includes it once; the module count counts it once. |
| T3 | A topic has only suggested links | No icon for students. |
| T4 | Open a question from a topic list | Detail shows topic chips; the previous/next buttons stay within that topic's list; a chip opens that topic's notes. |
| T5 | CSE and IT share the PYQ subject but have different topics | Each syllabus shows only questions linked to its own topics. |
| T6 | Admin runs `suggest` for Computer Networks | About 220 questions get up to 3 suggestions each; nothing student-visible changes. |
| T7 | Reviewer confirms a suggestion | The link becomes visible to students within the cache window; the audit shows who confirmed. |
| T8 | A reviewer granted only `list_unlinked`, `set`, `review` calls `bulk` | Denied. |
| T9 | `bulk` dry run with a misspelled topic title | Reported as unmatched; nothing written. |
| T10 | Admin replaces a subject's modules with the same titles | Topic ids unchanged, links intact. |
| T11 | Admin deletes a topic | Its links are hidden and listed as orphaned. |
| T12 | The counts call fails or the phone is offline with no cache | Topic rows show no icon; the screen works as today. |
| T13 | Student opens a PYQ subject with a mapped syllabus | "Syllabus and notes" opens the right subject (asks which if several). |
| T14 | `coverage` after the pilot | Shows linked, unlinked, pending and topics without questions per subject. |

---

## 8. Plan: how we handle it

### 8.1 Phases

| Phase | What | Output | Depends on |
|---|---|---|---|
| **0. Data preparation** | An admin maps PYQ subjects to syllabus subjects **by hand** with `map_subject` (no automatic matching) for each syllabus subject that has papers. Decide the pilot subject. | Mapping filled; list of subjects with no past papers | none |
| **1. Link foundation (server)** | Topic link model and indexes; `manage_topic_links` with `map_subject`, `set`, `add`, `remove`, `bulk`, `list_unlinked`, `coverage`; audit; REST under `/api/admin-app`; tests. | A person can link questions by tool or file | Phase 0 |
| **2. Student reads and screens** | Public counts, topic question list, topic chips on question detail, reverse link in the PYQ tab; app icon, topic list screen, chips; offline; tests. | Students see the PYQ icon on linked subjects | Phase 1 |
| **3. Suggestions** | Embedding ranking, store, review queue and review actions; the Computer Networks pilot and acceptance measurement. | Review queue; measured accuracy | Phase 1 |
| **4. In-app admin workbench** | Topic links section: mapping, coverage, linking workbench, review queue. | Admins link and review from the phone | Phases 1 and 3 |
| **5. Insights and feedback** | "Most asked topics", frequency in the list header, "wrong topic" reports, link to the exam-countdown study plan. | Prioritisation features | Phase 2 onwards |

Phases 2 and 3 can run in parallel after Phase 1. **The student feature ships the moment Phase 2 is live for the first finished subject**; coverage then grows subject by subject without app updates.

### 8.2 Rollout and risk

1. **Pilot first**: Computer Networks (CSE and IT, about 220 questions) end to end through Phases 0 to 3 before touching other subjects. It exercises the shared-PYQ-subject case, the module mismatch (5 chapters vs 6 and 5 modules) and the suggestion quality.
2. **Subject by subject**: a subject goes live (icons appear) when its coverage reaches an agreed bar, not all at once. Until then it behaves as today.
3. **Risks**

| Risk | Mitigation |
|---|---|
| Wrong links mislead students | Confirmed-only visibility, reviewer identity, audit, student reports (phase 5), acceptance threshold before scaling |
| Review is slow | Confidence ordering, one-tap accept, bulk import for offline work |
| Edge cache serves stale links | 5-minute TTL on these GETs and cache clear after writes |
| Embeddings quality is poor for some subjects | Pilot gate (TQ-SG-5); manual and bulk paths always available |
| Topic edits orphan links | Stable ids already preserved; orphan report; 180-day cleanup |
| Question text with math or images embeds badly | Use `plainText`; fall back to manual linking |

### 8.3 What changes for whom

- **Students:** a PYQ icon and counts on topics, a topic question list, topic chips on questions, a way back to the syllabus.
- **Admins:** a new tool (MCP, REST, then in-app) with coverage and a review queue; everything audited.
- **Operators:** one new collection with indexes, one new admin tool, short-TTL public reads. No new infrastructure.

---

## 9. Decisions needed (recommended default in bold)

| # | Question | Recommendation |
|---|---|---|
| D1 | Store links in a separate collection, or embed topic ids in each question? | **Separate collection**: many-to-many, review status, and per-syllabus links need it. |
| D2 | Use AI suggestions at all, or manual and bulk only? | **Suggestions with mandatory human confirmation.** Manual and bulk stay available. |
| D3 | Show a PYQ icon on topics with zero confirmed questions? | **No**: hide it, so the icon always leads somewhere. |
| D4 | Show counts on the icons? | **Yes**, distinct questions per topic. |
| D5 | Acceptance bar to scale beyond the pilot? | **At least 70% of top suggestions accepted unchanged**, otherwise rely on manual and bulk. |
| D6 | Cap on topics per question? | **8 per syllabus subject.** |
| D7 | First subjects? | **Computer Networks (CSE and IT)**, the two already mapped. |
| D8 | Student "wrong topic" reports in v1? | **Later (phase 5).** |
| D9 | Edge cache TTL for these reads | **5 minutes**, with cache clear after admin writes. |
| D11 | Automatic subject mapping? | **No. Subject mapping is manual, by an admin.** |
| D10 | Who may link? | **Full admins for everything; a reviewer grant limited to `list_unlinked`, `set`, `review_queue`, `review`.** |

---

## 10. Traceability

| Need | Requirements |
|---|---|
| Student sees only this topic's questions | TQ-FR-1, 2, 7, 8, 9 |
| A question can have several topics | TQ-DR-1, 3, TQ-FR-2, 10, T2 |
| Student goes from a question to the notes and back | TQ-FR-3, 10, 11 |
| Admin can link at scale | TQ-AD-2 to 5, TQ-SG-1 to 6, TQ-AA-1 to 3 |
| Quality and accountability | TQ-AD-8, 9, TQ-DR-4, TQ-FB-1 |
| Shared PYQ subject across branches | TQ-DR-1, 6, TQ-FR-11, T5 |

## 11. Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 (draft) | 2026-10-12 | Initial requirement analysis, SRS and plan from the verified data model |
