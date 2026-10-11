# SRS: Admin Features for Accounts, Sync and App Control

Structured after IEEE Std 830-1998. Related: `SRS-account-progress-sync-android.md`, `SRS-account-progress-sync-backend.md`.

| Field | Value |
|---|---|
| Product | PyQdeck admin MCP (`/admin-mcp`) and the supporting server and app changes |
| Document version | 1.0 (draft for review) |
| Date | 2026-10-11 |
| Status | Approved. Phase 1 implemented on server branch `feat/admin-phase1`; Phases 2 and 3 not started. |
| Evidence | Verified against server `main` at `47182bd`: `mcp/adminMcpServer.js`, `mcp/adminAccess.js`, `config/adminAccess.js`, `models/User.js`, `services/notificationService.js`, `services/progressService.js`, `events/handlers.js`. |

---

## 1. Introduction

### 1.1 Purpose
Accounts, cross-device sync and targeted push now exist, but an operator can neither see nor support any of it. This SRS defines the admin features needed to run the product: look up and support a student, see whether sync and push are healthy, keep a record of what admins did, and switch features off or warn users without shipping a new APK.

### 1.2 Scope
In scope: new admin MCP tools, an audit log, usage statistics, a remote app configuration, and the small app changes that configuration needs.
Out of scope: a web admin dashboard (the admin MCP is the admin interface), changing a user's role from the MCP, billing or subscriptions, new student-facing features.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Admin MCP | The Clerk-OAuth-protected MCP server at `/admin-mcp`. An account connects as admin by DB role `admin` or by an entry in `config/adminAccess.js`. |
| Grant | What one account may do with one tool: allowed actions, plus branches for the two branch-scoped tools. |
| Write action | Any action that changes data or sends something to users. |
| Audit entry | A stored record of one write action: who, which tool and action, which target, when, and the outcome. |
| App config | A small server-held document the app reads at launch to learn the minimum supported version, a banner message, and feature switches. |

### 1.4 Current state (verified in code)

| Area | Today | Source |
|---|---|---|
| Admin tools | `whoami`, `manage_syllabus`, `manage_notes`, `manage_catalog`, `manage_content`, `manage_moderation`, `send_notification`, `manage_ai_overview`, `clear_cache`, `manage_ads`. | `mcp/adminMcpServer.js`, `ADMIN_TOOLS` in `mcp/adminAccess.js` |
| Access control | Role `admin` gets everything. An email listed in `config/adminAccess.js` gets exactly its grants, overriding the role. Per-call checks: `assertAction`, branch scope. | `mcp/adminAccess.js` |
| Users | Nothing lets an admin find a user, see their devices or sync state, or help with a problem. The User model has **no timestamps**; sign-up time can only be read from the `_id`. | `models/User.js` |
| Notifications | Broadcast, group (`signed_in`, `signed_out`, `beta`), or named users, with `dryRun`. There is no record of what was sent. | `services/notificationService.js` |
| Sync visibility | `GET /api/admin/sync-metrics` returns in-memory counters that reset on restart and are per process, so each host shows only its own. | `events/handlers.js` |
| Audit | No record of admin actions anywhere. Admin writes (content edits, notifications, cache clears) leave no trace of who did them. | grep of `mcp/`, `services/` |
| App control | The app cannot be told to show a notice, demand an update, or stop syncing without a new release. | `App.tsx`, `src/api/` |

---

## 2. Overall description

### 2.1 Feature summary
1. **User support tool** (`manage_users`): find a student, see a safe summary of their account and sync state, and perform a small set of support actions.
2. **Insights tool** (`app_insights`): read-only numbers about accounts, sync, devices and push, taken from the database so they survive restarts and cover both hosts.
3. **Audit log** (`audit_log` tool plus automatic recording): every admin write action is recorded; admins can read the log.
4. **Remote app config** (`manage_app_config` tool plus `GET /api/public/app-config` and app behaviour): minimum version, banner message, and kill switches.

### 2.2 Users
| Class | Interaction |
|---|---|
| Full admin | All new tools. |
| Scoped admin (ACL entry) | Only the tools and actions granted to them. New tools follow the same grant model. |
| Student app | Reads the app config; unaffected otherwise. |

### 2.3 Constraints
- CR-1: Admin access control stays as it is. New tools are added to `ADMIN_TOOLS` and honour `actions` grants. No new auth mechanism.
- CR-2: Student data an admin can see is the minimum needed to support them (section 5). Progress contents (which topics were ticked) are not shown, only counts.
- CR-3: Anything destructive needs an explicit `confirm: true` argument and is audited.
- CR-4: Existing endpoint and tool contracts do not change; additions only.
- CR-5: Runs on both origins and works with one shared MongoDB.
- CR-6: No Redis or paid infrastructure (free-tier limits make per-request external stores unattractive).

### 2.4 Assumptions
- A1: Both hosts use one MongoDB. (Still to confirm; insights and audit assume it.)
- A2: Admins are few and trusted; the audit log is for accountability and debugging, not for hostile-admin defence.

---

## 3. Specific requirements

### 3.1 Audit log (foundation, built first)

| ID | Requirement | Priority |
|---|---|---|
| ADM-FR-1 | A new collection stores one entry per admin **write** action: admin id and email, tool, action, a short target description (for example `user:<clerkId>`, `subject:<slug>`), outcome (`ok` or `error`), and time. | M |
| ADM-FR-2 | Recording MUST happen in one place that wraps tool handlers, not be copied into each tool, so a tool added later is audited by default. Read-only actions MUST NOT be recorded. | M |
| ADM-FR-3 | An entry MUST NOT contain student progress, note bodies, push tokens, or the notification body; titles and counts only (a notification entry records the title, the audience and the delivery counts). | M |
| ADM-FR-4 | Entries expire automatically after 365 days (TTL index). | S |
| ADM-FR-5 | A failure to write an audit entry MUST be logged and MUST NOT fail the admin action. | M |
| ADM-FR-6 | Tool `audit_log` (read-only): list recent entries, newest first, filterable by admin email, tool, and date range; capped at 100 per call with an offset. | M |

### 3.2 User support: `manage_users`

Actions: `find`, `get`, `set_beta`, `unlink_devices`, `reset_progress`. (`delete_account` is Phase 3, section 8.)

| ID | Requirement | Priority |
|---|---|---|
| ADM-FR-7 | `find`: search by exact email, exact Clerk id, or an email prefix (minimum 3 characters). Returns at most 20 matches with name, email, role, `isBeta` only. | M |
| ADM-FR-8 | `get` (by email or Clerk id) returns a support summary: name, email, role, `isBeta`, sign-up time (from `_id`), `lastActiveAt`, the synced settings (Ask AI engine, reading layout, volume scroll, syllabus branch), counts of progress records and done topics, subject count, number of registered devices and how many are linked to the account, last progress change time, counts of solution votes, note votes and reports. It MUST NOT return which topics were ticked, tokens, or recents. | M |
| ADM-FR-9 | `set_beta` sets `isBeta` true or false. Used to build the `beta` notification audience. | S |
| ADM-FR-10 | `unlink_devices` removes the account link from all of the user's push tokens (the tokens stay registered for broadcasts). Requires `confirm: true`. For a user who reports getting someone else's pushes on a shared phone. | S |
| ADM-FR-11 | `reset_progress` deletes all of the user's synced progress records, using the same operation as `DELETE /api/me/progress`. Requires `confirm: true`. The student's phones keep their own local copy (nothing is removed there) and only re-send a topic if the student changes it, so the result MUST say that; a phone that signs in fresh starts from the empty account. | S |
| ADM-FR-12 | Role changes MUST NOT be possible through this tool. Roles stay a database or ACL matter. | M |
| ADM-FR-13 | Every write action here MUST be audited (ADM-FR-1). `find` and `get` are not audited because they are reads, but see ADM-NFR-4. | M |
| ADM-FR-14 | Grants: `manage_users` honours `actions`, so a support person can be given `find` and `get` only. | M |

### 3.3 Insights: `app_insights`

Read-only, computed from the database (not from per-process counters).

| ID | Requirement | Priority |
|---|---|---|
| ADM-FR-15 | `accounts`: total accounts, accounts created in the last 7 and 30 days (from `_id`), accounts active in the last 7 and 30 days (`lastActiveAt`, which is maintained by the server on sync). | M |
| ADM-FR-16 | `sync`: accounts with at least one progress record, total records, accounts whose progress changed in the last 7 and 30 days, accounts using each synced setting value (Ask AI engine counts, layout counts), accounts with Jump Back In data. | M |
| ADM-FR-17 | `devices`: registered push tokens, how many are linked to an account, how many accounts have two or more devices. | M |
| ADM-FR-18 | `votes`: totals of solution votes, note votes, and open reports of each kind. | S |
| ADM-FR-19 | `ops`: the in-memory sync counters of the host that answered (requests, ops applied, superseded, rejected by code, section errors, uptime), labelled with the host's `ORIGIN_ID`, so an admin does not mistake one host for the whole. | S |
| ADM-FR-20 | The server MUST update `lastActiveAt` (at most once per user per hour) when a signed-in sync request arrives. | M |
| ADM-FR-21 | Counts only: no emails, ids, or content in insight output. | M |

### 3.4 Remote app config: `manage_app_config` and the app

| ID | Requirement | Priority |
|---|---|---|
| ADM-FR-22 | A single document holds: `minAppVersion` (semver string or empty), `recommendedAppVersion`, `banner` (`{ message, level: info or warning, id }` or empty), and `flags` (`syncEnabled`, `settingsSyncEnabled`, `nudgesEnabled`, each true by default). | M |
| ADM-FR-23 | Tool `manage_app_config` with actions `read` and `update`. `update` validates every field (semver format, message length at most 200, known flag names only) and is audited. | M |
| ADM-FR-24 | `GET /api/public/app-config` returns the document, anonymous, cacheable for 60 seconds. A missing document returns defaults, never an error. | M |
| ADM-FR-25 | App: fetch the config at launch and on returning to the foreground (at most once per 10 minutes), keep the last good copy so it works offline, and never block startup on it. | M |
| ADM-FR-26 | App: when the running version is below `minAppVersion`, show a blocking "Update required" screen with a button to the store listing. Below `recommendedAppVersion` only, show a dismissible prompt once per version. | M |
| ADM-FR-27 | App: show `banner.message` as a dismissible strip on Home; a dismissed banner stays dismissed until its `id` changes. | S |
| ADM-FR-28 | App: `syncEnabled: false` stops the sync engine (progress, settings, recents) and leaves local data untouched; `nudgesEnabled: false` ignores sync nudges. Both are an emergency brake if a sync bug is found in the field. | M |
| ADM-FR-29 | Server: honour `syncEnabled: false` on `/api/me/sync` by answering `503` with `code: "sync_disabled"`, so older app builds that do not read the config also back off. | S |
| ADM-FR-30 | A bad config (unparseable, wrong types) MUST be ignored by the app in favour of the last good copy or defaults. | M |

### 3.5 Notification history

| ID | Requirement | Priority |
|---|---|---|
| ADM-FR-31 | `send_notification` gets no new arguments. Its result is recorded in the audit log (title, audience or target count, sent, failed, pruned) and so is readable through `audit_log`. | S |

---

## 4. Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| ADM-NFR-1 | `find`, `get` and `app_insights` answer in under 1.5 s with the current data size (about 223 accounts, tens of thousands of records at most). Aggregations use indexes or bounded scans. | S |
| ADM-NFR-2 | The audit wrapper adds no more than one small insert to a write action and never blocks the response on failure. | M |
| ADM-NFR-3 | New code follows the repo conventions and ships with tests: access grants per action, `confirm` enforcement, audit recorded for writes and not for reads, output contains no forbidden fields, config validation, 503 `sync_disabled`. | M |
| ADM-NFR-4 | Viewing a user's details is itself sensitive. `get` output is limited as in ADM-FR-8, and the privacy page MUST mention that administrators can see account support information (section 6). | M |
| ADM-NFR-5 | Backwards compatible and deployable to both hosts with no downtime. | M |
| ADM-NFR-6 | Insight queries MUST NOT scan collections without an index on large collections; where a new index is needed it is listed in the implementation notes. | S |

---

## 5. Data an admin can see (privacy summary)

| Data | `find` | `get` | `app_insights` | `audit_log` |
|---|---|---|---|---|
| Email and name | yes | yes | no | admin's own email only |
| Role, beta flag | yes | yes | no | no |
| Sign-up and last active time | no | yes | counts only | no |
| Synced settings | no | yes | counts only | no |
| Which topics were ticked | no | **no** | no | no |
| Counts of progress, votes, devices | no | yes | totals | no |
| Push tokens | no | **no** | counts only | no |
| Recents, notes content | no | **no** | no | no |

---

## 6. Compliance and documentation changes

- Privacy policy: add that operators with admin access can look up an account by email to provide support, see settings and counts, and that admin actions are logged for a year.
- Account deletion: unchanged; `handleUserDeleted` MUST also remove audit entries that name the deleted user as a **target** only if they contain personal data. Entries refer to targets by Clerk id and contain no email, so they are kept for accountability (state this on the privacy page).

---

## 7. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| X1 | Full admin calls `manage_users find` with an email | One match with name, email, role, beta only. |
| X2 | `get` on that user | Summary per ADM-FR-8; no topic list, no tokens, no recents. |
| X3 | Scoped admin granted only `find` and `get` calls `reset_progress` | Access denied. |
| X4 | `reset_progress` without `confirm` | Refused with an explanation; nothing deleted. |
| X5 | `reset_progress` with `confirm: true` | Progress rows deleted; result states the phones keep their local copy; an audit entry exists. |
| X6 | `unlink_devices` | Tokens stay, `voterId` removed; an account push no longer reaches the phone, a broadcast still does. |
| X7 | `set_beta` true, then `send_notification` with `audience: beta` and `dryRun` | The user is counted. |
| X8 | Any write tool is called | One audit entry with admin, tool, action, target, outcome. A read-only call adds none. |
| X9 | The audit insert fails (simulated) | The admin action still succeeds; the failure is logged. |
| X10 | `audit_log` filtered by tool and date | Newest first, capped at 100. |
| X11 | `app_insights` | Counts for accounts, sync, devices, votes, plus the answering host's ops counters; no identifiers. |
| X12 | `manage_app_config update` with `minAppVersion` above the installed version | The app shows "Update required" on next launch or foreground; below it, normal. |
| X13 | Banner set, user dismisses, admin edits the text but keeps the `id` | Stays dismissed. New `id`: shows again. |
| X14 | `syncEnabled: false` | App stops syncing; local data intact. An older app build calling `/api/me/sync` gets 503 `sync_disabled` and backs off. |
| X15 | Config endpoint unreachable or returns garbage | The app uses the last good config or defaults and starts normally. |

---

## 8. Phasing and decisions needed

### 8.1 Phases
| Phase | Contents | Risk |
|---|---|---|
| 1 (server only) | Audit log and wrapper (3.1), `manage_users` (3.2, without delete), `app_insights` (3.3), `lastActiveAt` update (ADM-FR-20), ACL list update, tests, privacy text. | Low: additive, no app change. |
| 2 (server and app) | Remote app config (3.4): tool, endpoint, app fetch, update screen, banner, kill switches, 503 `sync_disabled`. | Medium: touches app startup; needs a build. |
| 3 (optional) | Admin-initiated account deletion (Clerk delete plus `handleUserDeleted`), scheduled notifications, notification templates. | Higher: destructive or needs a job runner. |

### 8.2 Decisions (recommended defaults in bold)
| # | Question | Recommendation |
|---|---|---|
| D1 | May admins see an account's email and synced settings? | **Yes, with the audit log and the privacy text (section 6).** |
| D2 | May an admin reset a user's progress? | **Yes, with `confirm`, audited; warn that phones keep their local copy.** |
| D3 | Role changes through the MCP? | **No. Keep roles in the database and ACL.** |
| D4 | Admin-initiated account deletion (Phase 3)? | **Not now.** Students delete their own accounts; Clerk and the webhook already purge. |
| D5 | Audit retention | **365 days.** |
| D6 | Force-update behaviour | **Blocking below `minAppVersion`, dismissible prompt below `recommendedAppVersion`.** |
| D7 | Phase 2 now, or after Phase 1 is in use? | **After**, so the audit log exists before the config tool can change app behaviour for everyone. |

---

## 9. Traceability

| Need | Requirements |
|---|---|
| Support a student who reports a sync or push problem | ADM-FR-7, 8, 10, 11 |
| Know whether the new features are used and healthy | ADM-FR-15 to 20 |
| Accountability for admin actions | ADM-FR-1 to 6, 31 |
| Warn users, force an update, or stop sync without a release | ADM-FR-22 to 30 |
| Target the right people with notifications | ADM-FR-9 (beta audience) |

## 10. Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 (draft) | 2026-10-11 | Initial draft from the verified admin surface |
