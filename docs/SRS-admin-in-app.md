# SRS: Admin Screens in the PyQdeck App

Structured after IEEE Std 830-1998. Builds on `SRS-admin-features.md` (the admin MCP tools, audit log and remote app config) and `SRS-account-progress-sync-*.md`.

| Field | Value |
|---|---|
| Product | PyQdeck Android app (admin section) and a small server API for it |
| Document version | 1.0 |
| Date | 2026-10-12 |
| Status | Scope chosen by the owner: dashboard and audit log, send notification, user support, app config. Authentication: the app's normal Clerk sign-in. |

---

## 1. Introduction

### 1.1 Purpose
The admin tools exist only as an MCP server, which needs an MCP client and an OAuth sign-in. This SRS adds the most-used ones to the app itself, so an admin can check the numbers, help a student, post a notice or send a notification from their phone.

### 1.2 Scope
In scope: an "Admin tools" entry in Settings (admin accounts only); four screens (Dashboard with audit log, Send notification, User support, App config); a server API under `/api/admin-app` that authenticates with the app's normal session token and enforces the **same grants and audit log** as the MCP.
Out of scope: content, syllabus, notes, catalog and moderation editing (stay on the MCP); role changes; any new sign-in flow.

### 1.3 Current state (verified)
| Area | Fact | Source |
|---|---|---|
| Admin auth | `/admin-mcp` and `/api/admin` verify **Clerk OAuth access tokens** (`requireAdminMcpAuth`). The app only holds normal **session** tokens, so it cannot call them. | `mcp/adminAuth.js` |
| Grants | `resolveAdminAccess(user)` turns a user into per-tool grants (role `admin` = everything; `config/adminAccess.js` can scope or narrow). `assertAction` enforces them on each call. | `mcp/adminAccess.js` |
| Audit | The guard around each MCP tool records every admin write. | `mcp/adminMcpServer.js` |
| Tools to expose | `app_insights`, `audit_log`, `manage_users`, `manage_app_config`, `send_notification` already exist as services. | `services/*` |
| App | Settings, a root stack in `App.tsx`, Clerk `useAuth`, the `/api/me` request helper pattern. | `App.tsx`, `src/api/index.ts` |

---

## 2. Overall description

### 2.1 Design
1. The grant-and-audit guard is **extracted** from `adminMcpServer.js` into a shared module and used by both the MCP and the new REST API. There is one place that decides who may do what and one audit trail, so the app cannot become a way around either.
2. New router `/api/admin-app`, mounted outside `/api/public`, always `Cache-Control: private, no-store`. It signs the caller in through the normal session (`attachUser`), requires a resolvable admin access (otherwise `403`), and rate-limits per account.
3. The app asks `GET /api/admin-app/me` once per signed-in session. `403` means "not an admin": the Settings entry never appears and nothing else is requested.
4. Screens show only what the account's grants allow (a support person with only `find` and `get` sees no destructive buttons).

### 2.2 Constraints
- CR-1: No new auth. CR-2: Server is the authority; the app hiding a button is convenience, not security. CR-3: Every write is audited by the shared guard. CR-4: Destructive or broadcast actions need an explicit confirmation step in the UI as well as `confirm: true` on the server. CR-5: Contracts of existing endpoints do not change.

---

## 3. Specific requirements

### 3.1 Server: `/api/admin-app`

| ID | Requirement | Priority |
|---|---|---|
| AIA-FR-1 | Extract the guard (grant check, action check, scope hook, audit recording) into `mcp/adminGuard.js`; the MCP server uses it unchanged in behaviour. | M |
| AIA-FR-2 | Mount `/api/admin-app` with `Cache-Control: private, no-store`, session auth, per-account rate limit, and database-readiness check. Unauthenticated: `401 unauthenticated`. Signed in but not an admin: `403 not_admin`. | M |
| AIA-FR-3 | `GET /me`: `{ access }` (the account's grants as `describeAccess`), so the app knows which screens and actions to offer. | M |
| AIA-FR-4 | `GET /insights` runs `app_insights`. `GET /audit` runs `audit_log` with the same filters. | M |
| AIA-FR-5 | `POST /users` runs `manage_users` with `{ action, query, email, clerkId, value, confirm }`. | M |
| AIA-FR-6 | `GET /config` and `PUT /config` run `manage_app_config` (`read`, `update`). | M |
| AIA-FR-7 | `POST /notify` runs `send_notification` (`title`, `body`, `audience`, `emails`, `dryRun`). | M |
| AIA-FR-8 | Errors map to HTTP: access denied `403 access_denied`, validation `400`, not found `404`, conflict `409`; body `{ message, code }`. | M |
| AIA-FR-9 | A tool the account is not granted answers `403 access_denied` even if the route exists. | M |

### 3.2 App

| ID | Requirement | Priority |
|---|---|---|
| AIA-FR-10 | When signed in, ask `GET /me` once per session (and after sign-in). Only an admin sees **Settings → Admin tools**. Sign-out clears the cached result. | M |
| AIA-FR-11 | Admin home lists only the screens the grants allow. | M |
| AIA-FR-12 | **Dashboard**: show the insight groups (accounts, sync, devices, votes, open reports, this host's counters) and the recent audit entries (newest first, "load more"). Pull-to-refresh. | M |
| AIA-FR-13 | **Send notification**: title (max 80), body (max 180), audience chips (all, signed in, signed out, beta) or a list of emails. A **Preview** step runs `dryRun` and shows the recipient count and unmatched emails. **Send** is enabled only after a preview for the current inputs, and asks for confirmation naming the audience and count. | M |
| AIA-FR-14 | **User support**: search by email or prefix; open a result to see the support summary; actions `set_beta`, `unlink_devices`, `reset_progress` (the last two behind a confirmation dialog that states the effect). Destructive buttons are hidden when the grant lacks the action. | M |
| AIA-FR-15 | **App config**: show current values; edit minimum and recommended version, banner (message, level, id), and the three switches. Saving asks for confirmation when it would block users (a minimum version above the installed one, or a switch turned off), and shows the server's validation errors. | M |
| AIA-FR-16 | Every screen handles loading, error with retry, and the offline case without crashing. Nothing admin is cached on disk. | M |
| AIA-FR-17 | Admin screens do not appear in any share, deep link or analytics event. | S |

---

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| AIA-NFR-1 | Server tests: auth (401/403), per-tool grants through the REST path, audit entries written for writes and not reads, error mapping, no-store header, the MCP's behaviour unchanged after the guard extraction. |
| AIA-NFR-2 | App: pure logic (form validation, preview-matches-send check) unit-tested with `node --test`; `tsc` clean. |
| AIA-NFR-3 | No admin data written to storage, logs or Sentry. |
| AIA-NFR-4 | Deploy order: server first; the app hides the admin entry on any `404`/`403`, so an app ahead of the server shows nothing. |

---

## 5. Acceptance scenarios

| # | Scenario | Expected |
|---|---|---|
| Y1 | A student account opens Settings | No "Admin tools" row; `/me` answered 403. |
| Y2 | A full admin opens Settings | "Admin tools" with four screens. |
| Y3 | A scoped admin granted only `manage_users: find, get` | Only User support, with no destructive buttons; a hand-made `reset_progress` request is `403`. |
| Y4 | Dashboard | Same numbers as `app_insights`; the audit list matches `audit_log`. |
| Y5 | Preview then Send to "beta" | Count shown first; send blocked until previewed; an audit entry holds the title and counts, not the body. |
| Y6 | Edit the preview text after previewing | Send is disabled until previewed again. |
| Y7 | Reset a student's progress | Confirmation text states the phones keep their local copy; audit entry written. |
| Y8 | Save a `minAppVersion` above the installed version | Confirmation warns it blocks this app too; saved only after confirming. |
| Y9 | Server returns 503 `sync_disabled` or the phone is offline | Admin screens show a retry state; nothing crashes. |

## 6. Revision history
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-12 | Initial; scope and auth chosen by the owner |
