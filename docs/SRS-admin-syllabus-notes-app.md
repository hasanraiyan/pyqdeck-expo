# SRS: Admin Syllabus & Notes CRUD from the Android App

Structured after IEEE Std 830-1998. Builds on `SRS-admin-features.md` (grants, audit), `SRS-admin-in-app.md` (in-app admin shell, `/api/admin-app`), `SRS-pyqdeck-app.md` (Study section) and `SRS-topic-wise-pyq.md` (topic links, `pyqSubjectId`).

| Field | Value |
|---|---|
| Product | PyQdeck Android app (Admin tools → Syllabus & Notes) and the `/api/admin-app` extension |
| Document version | 1.0 (approved) |
| Date | 2026-10-12 |
| Status | Approved by owner on 2026-10-12. Decisions D1–D5 accepted as recommended in section 7. |
| Evidence | `src/admin/useAdminAccess.ts`, `src/admin/adminLogic.ts` (grant check `can()`, in-memory only, `confirm` pattern); `docs/SRS-admin-in-app.md` (out-of-scope list); live MCP tool contracts for `manage_syllabus` / `manage_notes` (branch > semester > subject > module > topic, notes markdown + LaTeX + Mermaid + FAQ accordion) |

---

## 1. Introduction

### 1.1 Purpose
Syllabus structure (branches, subjects, modules, topics) and topic study notes can today only be edited through the admin MCP (`manage_syllabus`, `manage_notes`), which needs an MCP client + OAuth sign-in. This SRS brings that editing into the Android app itself, so an admin can fix a typo, add a missing topic, or rewrite notes from their phone without a laptop.

### 1.2 Scope
In scope: a **Syllabus & Notes** section inside the existing Admin tools (gated by grants); browsing the syllabus tree; CRUD on subjects, modules, topics; read / write / patch / clear on topic notes with a preview that matches what students see; subject search; the server REST that proxies the two MCP tools through the same grant + audit guard.

Out of scope: PYQ catalog / questions / solutions editing, topic-link editing (`topic_link` stays in `SRS-topic-wise-pyq.md` workbench), moderation, ads, AI overview, user management, notifications, app config (all covered by `SRS-admin-in-app.md`); new auth; WYSIWYG / image uploads in notes (notes are markdown text only); bulk CSV import; iOS; website.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Syllabus tree | `branch > semester > subject > module > topic`. A subject carries `branches: ["cse","ece"]` (deduped model — one document appears in many branches); modules/topics are embedded with stable `_id`s the app keys progress to. |
| Topic notes | Markdown writeup on one topic. Supports LaTeX (`$...$`, `$$...$$`), Mermaid (````mermaid`), and an FAQ accordion at the bottom under `## FAQ` (or `Frequently Asked Questions` / `Viva & Exam Questions`) with `### Q: ...` items, rendered natively by the app. Unset = notes icon hidden for students. |
| `pyqSubjectId` | Mapping from a syllabus subject to its PYQ subject slug (many syllabus subjects may share one). Validated on write. |
| Grant | Per-tool `{ actions: "*" \| string[], branches?: "*" \| string[] }` from `GET /api/admin-app/me`. UI hiding is convenience only; the server re-checks. |
| Write action | Any create / update / patch / delete on syllabus or notes. Always audited; destructive ones need `confirm: true`. |

### 1.4 Current state (verified)

| Area | Fact | Source |
|---|---|---|
| Admin shell | `useAdminAccess()` asks `GET /me` once per session, keeps result in memory only, drops on sign-out; `can(tools, tool, action)` gates UI; `403` = hide entry | `src/admin/useAdminAccess.ts`, `src/admin/adminLogic.ts` |
| Existing REST | `/api/admin-app` with `me`, `insights`, `audit`, `users`, `config`, `notify`; `Cache-Control: private, no-store`; error body `{ message, code }`; writes audited by shared guard | `docs/SRS-admin-in-app.md` §3.1 |
| Syllabus tool | `manage_syllabus`: action `create\|read\|update\|delete`, level `branch\|semester\|subject\|module\|topic`; identify by slug / module number-or-id / topic position-or-title-or-id; subject create accepts inline `data.modules`; topic create accepts `data.titles[]` for bulk; subject update supports `branches` replace / `addBranches` / `removeBranches`; semester is read-only (exists when subjects sit in it) | MCP contract |
| Notes tool | `manage_notes`: action `read\|update\|patch\|delete`; `update` replaces wholesale (`notes` non-empty markdown); `patch` applies ordered `{find, replace, replaceAll?}` + `append` all-or-nothing; `delete` clears to unset (topic kept) | MCP contract |
| Student app | Study tab browses the same tree; topic rows show notes icon only when notes exist; notes render with `NativeContentRenderer` (markdown, math, Mermaid, FAQ accordion); progress is device-local per subject | `docs/SRS-pyqdeck-app.md` FR-30–36 |
| Explicit gap | Content, syllabus, notes, catalog, moderation editing "stay on the MCP" in v1 of in-app admin | `SRS-admin-in-app.md` §1.2 |

Consequence: this SRS is a strict extension of `SRS-admin-in-app.md` — same auth, same guard, same UI rules — adding two tools (`manage_syllabus`, `manage_notes`) to the REST + app.

---

## 2. Overall description

### 2.1 Design in one paragraph
Extract nothing new: the existing grant-and-audit guard already wraps MCP handlers, and `SRS-admin-in-app.md` already extracted it for REST. Add two routes (`POST /syllabus`, `POST /notes`) that call `manage_syllabus` / `manage_notes` through that same guard with the caller's session, so grants (including branch scope), validation, audit, and error mapping behave identically whether the admin uses MCP or phone. The app adds one section (browser → subject → module/topic → notes editor) that shows only granted actions, previews notes with the student renderer, and sends `confirm: true` only after an explicit dialog. After any write the server invalidates syllabus/notes caches (existing clear path) so students pick it up within TTL.

### 2.2 Users

| Class | Interaction |
|---|---|
| Full admin (`admin` role) | Everything below. |
| Scoped / branch admin (ACL entry, e.g. `manage_syllabus: update` on `branches: ["cse"]`) | Only their branches and actions; other branches read-only or hidden per §4. |
| Student app | Unaffected except it reads fresher syllabus/notes after an admin edit (same as an MCP edit today). |

### 2.3 Constraints
- CR-1: No new auth. Session auth + `resolveAdminAccess` + `assertAction` as in `SRS-admin-in-app.md`. App hiding a button is not security.
- CR-2: Every write audited by the shared guard; audit holds target + counts, never note bodies, tokens, or emails (ADM-FR-3).
- CR-3: Destructive or broadcast-scope writes need UI confirmation **and** `confirm: true` on the server.
- CR-4: Existing endpoint/tool contracts unchanged; additions only. MCP behaviour unchanged.
- CR-5: Topic `_id`s preserved across edits (links + student progress key to them); a rename must not regenerate ids.
- CR-6: Nothing admin cached on disk, in logs, or Sentry (extends AIA-FR-16, AIA-NFR-3).

### 2.4 Assumptions
- A1: Admins are few and trusted; the audit log is for accountability, not hostile-admin defence (as in `SRS-admin-features.md` A2).
- A2: Syllabus/notes edits are low-frequency (a few per day); optimistic locking / conflict merge is out of scope — last write wins, and the editor warns when the topic changed underneath (ASN-FR-22).
- A3: Both server origins share one MongoDB (as in ADM CR-5).

---

## 3. Data requirements

### 3.1 Syllabus tree (no new fields)

| Level | Key fields the app shows/edits |
|---|---|
| Branch | `slug`, `name` (read-only in app; create/delete branch stays MCP-only — decision D2) |
| Semester | number only (read-only; exists when subjects sit in it) |
| Subject | `slug`, `name`, `code`, `semester`, `branches[]`, `kind` (theory\|lab), `credits {l,t,p,credits}`, `pyqSubjectId`, `order`, module/topic counts |
| Module | `number`, `title` |
| Topic | `title`, `prompt`, position, notes presence |

| ID | Requirement | Priority |
|---|---|---|
| ASN-DR-1 | Reads/writes go through `manage_syllabus` validation (slug format, `pyqSubjectId` must be an existing PYQ subject slug or empty, `branches` non-empty, semester 1–8). Server errors surface verbatim. | M |
| ASN-DR-2 | Renaming a subject/module/topic (slug, title) MUST NOT change subdocument `_id`s. | M |
| ASN-DR-3 | Deleting a subject/module cascades to its children. Deleting a topic keeps its topic-links hidden/orphaned per `SRS-topic-wise-pyq.md` TQ-DR-4; student progress rows for removed topics become inert (never crash). | M |
| ASN-DR-4 | `removeBranches` that would detach the last branch is refused — delete the subject instead (existing tool rule, surfaced in UI). | M |

### 3.2 Notes format

| ID | Requirement | Priority |
|---|---|---|
| ASN-DR-5 | Notes are a single markdown string: LaTeX `$...$` / `$$...$$`, Mermaid fenced blocks, FAQ accordion (`## FAQ` + `### Q: ...`) at the bottom. The editor MUST NOT accept empty string on `update` (use delete-to-clear instead). | M |
| ASN-DR-6 | `patch` edits (`{find, replace, replaceAll?}` + `append`) are all-or-nothing; each `find` must match exactly once unless `replaceAll`. The app MUST `read` first and copy exact text (same rule as MCP). | M |

---

## 4. Specific requirements

### 4.1 Server: extend `/api/admin-app`

| ID | Requirement | Priority |
|---|---|---|
| ASN-FR-1 | `POST /syllabus` runs `manage_syllabus` with `{ action, level, branch, semester, subject, module, topic, data }`. `POST /notes` runs `manage_notes` with `{ action, subject, module, topic, notes, edits, append }`. Both `private, no-store`, session auth, per-account rate limit. | M |
| ASN-FR-2 | Grants enforced as `manage_syllabus:<action>` / `manage_notes:<action>` plus `branches` scope: a call touching a subject outside the caller's branches answers `403 access_denied` even if the action is granted. `*` covers all actions. | M |
| ASN-FR-3 | Errors reuse the existing map: `403 access_denied`, `400` validation (incl. ambiguous topic title, `pyqSubjectId` unknown, empty notes, patch `find` miss), `404` subject/module/topic, `409` slug clash; body `{ message, code }`. | M |
| ASN-FR-4 | Every write writes one audit entry (admin, tool, action, target e.g. `subject:<slug>/module:<n>/topic:<title>`, outcome). Reads write none. Audit never holds note bodies. | M |
| ASN-FR-5 | After any write, invalidate the syllabus/notes API caches on **both** origins + edge purge for the affected subject through the existing cache-clear path (same as MCP writes). | M |
| ASN-FR-6 | `GET /me` `access.tools` gains `manage_syllabus` and `manage_notes` grants so the app knows which section/actions to offer. No other contract change. | M |

### 4.2 App: inline editing on existing Study screens (owner pivot 2026-10-12)

No separate admin browser. Editing lives where students browse, gated by
`can(tools,…)` like `ManagePaperSheet` on the question list. Students see no
change; non-granted admins see no pencils.

| ID | Requirement | Priority |
|---|---|---|
| ASN-FR-10 | No new AdminHome tile. `TopicNotesScreen` shows a pencil iff `can(tools,"manage_notes","update"\|"*")`; `SubjectSyllabusScreen` shows topic/module pencils + Add buttons iff `can(tools,"manage_syllabus","create"\|"update"\|"*")`; `SyllabusOverviewScreen` shows subject pencils + New iff the same. Otherwise hidden. | M |
| ASN-FR-11 | Reads reuse the public syllabus API + React Query cache students use (branch → semester → subject → modules/topics). Only writes go through `/api/admin-app`. Pull-to-refresh keeps working; a failed write shows retry, never a crash. | M |
| ASN-FR-12 | Subject sheet (`ManageSubjectSheet` from `SyllabusOverviewScreen`): `name`, `code`, `kind`, `pyqSubjectId`; create inherits branch+semester, slug auto-suggested (editable on create only). Branch moves stay MCP-only (D2). Delete states module/topic cascade + `confirm:true`. Save shows server errors inline. | M |
| ASN-FR-13 | Module sheet (`ManageModuleSheet` from `SubjectSyllabusScreen` module headers + Add module): `number` (1–32), `title`; create / rename / delete (delete dialog states cascade count, e.g. "Module 2 holds 14 topics with notes on 9 — all will be removed"). | M |
| ASN-FR-14 | Topic sheet (`ManageTopicSheet` from `SubjectSyllabusScreen` topic rows + Add topic): `title`, `prompt`; create single + **bulk add** (`titles[]` via pasted lines, one per line, skips blanks, reports how many will be added before confirm); rename (warns id is kept — links + progress survive; shows PYQ link count); delete (states notes + link consequences, `confirm:true`). Explicit reorder out of scope (C). | M |
| ASN-FR-15 | Branch create/delete + attach/detach stay MCP-only (decision D2). App covers subject and below. | S |
| ASN-FR-16 | Deferred: in-section subject/topic search box (public search already exists on Search tab). | C |
| ASN-FR-17 | Every sheet handles loading / error-with-retry / offline-without-crash. Writes are **blocked offline** with a plain message ("Connect to edit — drafts are not queued"); drafts live in the sheet only, never on disk. | M |
| ASN-FR-18 | No admin data in share sheets, deep links, analytics, or persisted cache. | M |

### 4.3 App: notes editor

| ID | Requirement | Priority |
|---|---|---|
| ASN-FR-20 | Topic row → **Notes** opens editor with `Edit | Preview` tabs. `Edit` is a plain-text markdown field with a toolbar: Bold, List, `H`, `$math$`, `$$block$$`, `mermaid` template, `FAQ` template (`## Frequently Asked Questions` + `### Q: `). Character + line count shown. | M |
| ASN-FR-21 | `Preview` renders with the **same student renderer** (markdown, LaTeX, Mermaid, FAQ accordion, callouts/code/images fallback) so parity is guaranteed; render failure shows the block-level fallback, never a crash. | M |
| ASN-FR-22 | Open does `notes/read` first; Save does `update` (full replace) for small notes and `patch` (`edits`/`append`) when only a section changed (app picks `patch` when the diff is a clean append or ≤3 find/replace hunks, else `update`). If the server reports the notes changed since open, show "Changed by <time> — Reload / Overwrite" (overwrite needs a second confirm). | M |
| ASN-FR-23 | **Clear notes** (delete-to-unset) sits behind a confirm dialog ("Students will no longer see a notes icon on this topic. The topic itself stays."). The row dot clears on success. | M |
| ASN-FR-24 | Empty editor cannot be saved as `update` (button disabled with "Notes cannot be empty — use Clear to remove"); server `400` surfaced verbatim otherwise. | S |

### 4.4 Safety, confirmations, audit visibility

| ID | Requirement | Priority |
|---|---|---|
| ASN-FR-30 | Destructive actions (delete subject/module/topic, detach branch, clear notes, bulk-add topics) need an in-app confirm dialog stating scope + an explicit `confirm: true` where the tool requires it. Save buttons for these read "Delete …" / "Clear …", never "Save". | M |
| ASN-FR-31 | Section footer links to **Dashboard → Audit** pre-filtered to `manage_syllabus` / `manage_notes` so an admin can see who changed what after the fact. | S |
| ASN-FR-32 | Pure logic (slug suggest, bulk-titles parse, patch-vs-update pick, confirm-text builder, grant gating via `can()`) is unit-tested with `node --test`; `tsc` clean. | M |

---

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| ASN-NFR-1 | List screens answer in < 1.5 s on current data size (46 subjects); subject read with full tree < 2 s; notes save round-trip < 2 s on a mid-range Android device excluding network. Reads use existing indexes; no collection scans. |
| ASN-NFR-2 | Backwards compatible: older apps ignore new fields; student Study screens work unchanged when coverage is zero. Deploy order server-first; app hides the section on `404`/`403` so an app ahead of the server shows nothing. |
| ASN-NFR-3 | Server tests: auth (401/403 incl. branch-scope denial), per-action grants for both tools, audit written for writes / not reads, error mapping, no-store header, MCP behaviour unchanged, cache invalidation after writes. |
| ASN-NFR-4 | No admin content in AsyncStorage, logs, or Sentry (extends AIA-NFR-3 to syllabus/notes bodies). |
| ASN-NFR-5 | Accessibility: every icon button labelled ("Add topic", "Edit notes", "Delete module"); editor toolbar reachable by TalkBack; contrast per WCAG AA where the existing kit provides it. |

---

## 6. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| S1 | Student account opens Settings | No Admin tools; `/me` 403. |
| S2 | Full admin opens Admin tools | "Syllabus & Notes" tile present; branch → semester → subject → modules/topics browse works. |
| S3 | Branch-scoped admin (`cse` only) opens ECE subject editor | Fields read-only/disabled; save attempt (hand-made) → `403 access_denied`. |
| S4 | Fix a topic title typo with notes + 2 PYQ links | Rename saves, id kept; notes still open; links intact (spot-check via `topic_link` read); audit entry with target. |
| S5 | Add 10 topics by pasting lines | Preview "10 topics will be added to Module 3"; confirm creates all; counts update. |
| S6 | Delete a module with 14 topics (9 with notes) | Dialog states "14 topics, 9 notes will be removed"; confirm deletes; student subject screen no longer lists them; progress rows inert. |
| S7 | Edit notes: append one FAQ item | App uses `patch`+`append`; preview shows new accordion item exactly as students see it. |
| S8 | Two admins edit the same notes | Second saver sees "Changed by … — Reload / Overwrite"; overwrite needs second confirm; audit shows both. |
| S9 | Clear notes on a topic | Confirm states icon disappears but topic stays; after clear, student row shows no notes icon. |
| S10 | Set `pyqSubjectId` to a typo slug | `400` with "unknown PYQ subject"; nothing written. |
| S11 | Phone offline, tap Save | "Connect to edit" message; nothing queued; draft kept in the editor only. |
| S12 | Edit from MCP after this ships | Same validation, grants, audit; student app sees the change within the same TTL (no app divergence). |

---

## 7. Phasing and decisions needed

### 7.1 Phases

| Phase | Contents | Risk |
|---|---|---|
| 1 (server) | `POST /syllabus`, `POST /notes` via shared guard; `me` grants; branch-scope checks; audit; cache invalidation; tests | Low — additive, MCP unchanged |
| 2 (app browse + tree CRUD) | Section shell, browser, subject/module/topic editors, search, confirms (ASN-FR-10–17, 30–32) | Medium — touches admin stack; needs a build |
| 3 (notes editor) | Edit/Preview tabs, toolbar, update-vs-patch, conflict prompt, clear (ASN-FR-20–24) | Medium — large-text handling, renderer parity |
| 4 (polish, optional) | Audit deep-link filter, pyqSubject picker polish, orphan-progress notice, bulk-edit from topic-links workbench | Low |

Phases 2 and 3 can overlap after Phase 1. Ship browse + subject fix flow first; notes editor follows.

### 7.2 Decisions (recommended defaults in bold)

| # | Question | Recommendation |
|---|---|---|
| D1 | Who may edit from the app? | **Same grants as MCP (full admin everything; scoped by action + branch).** No app-only role. |
| D2 | Branch create/delete + semester edits in app? | **No — MCP-only.** App covers subject and below (+ branch attach/detach on a subject). |
| D3 | Notes review step (draft → publish)? | **No — direct publish with audit (edits are low-frequency).** Revisit if edit wars appear. |
| D4 | Images/media inside notes from the phone? | **No v1 (markdown text only).** Image-picker upload is a separate SRS if wanted. |
| D5 | Offline queue for edits? | **No — block offline.** Queueing risks conflicts and stale overwrites; drafts live in the editor only. |

---

## 8. Traceability

| Need | Requirements |
|---|---|
| Fix syllabus from the phone | ASN-FR-1–3, 10–16, 30 |
| Rewrite notes from the phone with student-faithful preview | ASN-FR-1–3, 20–24, ASN-DR-5–6 |
| Branch-scoped editors can't touch other branches | ASN-FR-2–3, 11, 15, S3 |
| Accountability | ASN-FR-4, 31 |
| Students see edits promptly, older apps safe | ASN-FR-5–6, ASN-NFR-2, S12 |
| No foot-guns | ASN-FR-13–14, 22–23, 30, ASN-DR-2–4 |

## 9. Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 (draft) | 2026-10-12 | Initial draft; extends `SRS-admin-in-app.md` (which scoped syllabus/notes out) to cover them in-app |
| 1.0 (approved) | 2026-10-12 | Approved by owner |

