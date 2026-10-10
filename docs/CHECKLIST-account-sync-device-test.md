# Device test checklist: account sync, sign-out wipe, targeted push

Run this on a real phone with the built APK/AAB installed (version 1.3.0 or later).
Tick each box. If a step fails, write what you saw next to it.

Tester: ____________  Device/Android: ____________  Build (versionCode): ______  Date: ______

---

## 0. Before you start (one-time setup)

- [x] Server is deployed on **both** EC2 and Render with the latest `main` (`/api/me/progress/sync` exists).
- [x] Both hosts use the **same `MONGO_URI`** (compare the two `.env` files, same cluster and database name).
- [x] Clerk dashboard has the `user.deleted` webhook registered for `https://api.pyqdeck.in/api/webhooks/clerk`, and `CLERK_WEBHOOK_SIGNING_SECRET` matches.
- [x] Quick server check from a browser/terminal: `GET https://api.pyqdeck.in/api/ping` and `https://ec2-api.pyqdeck.in/api/ping` both return `status: ok`.
- [x] `GET .../api/me/progress/summary` **without** a token returns `401` with `"code": "unauthenticated"`.
- [x] You have **two test accounts** (A and B) and ideally a **second device** (or an emulator) for A.
- [x] Debug build is not required, but have `adb logcat` or Sentry open to watch for errors.

---

## 1. Fresh install, signed out (nothing should change)

- [x] App opens, onboarding shows once.
- [x] Browse papers, open a solution, use Search: all work with no account.
- [x] Study tab: tick 3 topics in a subject. Ticks show instantly.
- [ ] Force-stop the app and reopen: the 3 ticks are still there.
- [ ] A small pill "Sign in to back up your progress  |  x" shows on the Study tab, with the x right next to the text (even padding). Tap **x**: it disappears and stays gone after restarting the app.
- [ ] Turn on airplane mode: everything above still works. No error popups.

## 2. First sign-in merge (account A)

- [ ] With the 3 signed-out ticks present, sign in as **A** (A has no server progress yet).
- [ ] Within a few seconds the Study bar shows "Syncing..." then "Progress saved to your account".
- [ ] The 3 ticks are still there (nothing lost).
- [ ] Settings shows **Sync progress** switch (on), last-synced time, and **Sync now**.

## 3. Sync across two devices (account A)

- [ ] On device 2, sign in as A. After the first sync, the same 3 ticks appear.
- [ ] Tick topic X on device 1. Open the Study tab on device 2 (or tap **Sync now**): X is ticked.
- [ ] Untick X on device 2, then sync device 1: X is unticked on both.
- [ ] Conflict: take device 1 offline, tick Y; on device 2 untick Y later; bring device 1 online. The **newer** change wins on both.

## 4. Offline queue

- [ ] Airplane mode on. Tick 2 topics. Study bar shows "Offline - 2 waiting to sync".
- [ ] Kill the app, reopen (still offline): the 2 ticks and the "waiting" count survive.
- [ ] Airplane mode off. Within ~10 s the bar goes to "saved" and the other device shows both ticks.

## 5. Sign-out from Settings (the wipe)

Before signing out, make sure the phone has: ticked topics, a Jump Back In entry on Home, a cast vote on a solution, a recent search, and some downloaded content.

- [ ] Settings → **Sign out** shows the warning: "Progress, history and downloaded content on this device will be removed. Your progress stays saved to your account."
- [ ] Confirm. The app returns to the **Browse** tab root (no old detail screen left on the stack).
- [ ] Study tab: ticks are gone. Home: Jump Back In is empty. Search: recent searches are empty. The solution vote highlight is gone.
- [ ] Settings: display settings (reading layout, volume-scroll) are **kept**. Onboarding does **not** show again.
- [ ] Sign back in as A: ticks come back from the server. Open the solution you voted on: your vote highlight is restored.

## 6. Sign-out with unsynced changes

- [ ] Airplane mode on, tick 2 topics, then Settings → Sign out → confirm.
- [ ] A second warning appears: "Some progress is not synced" with the count (2) and **Cancel** / **Sign out anyway**.
- [ ] **Cancel** keeps you signed in with the ticks intact.
- [ ] Repeat and choose **Sign out anyway**: signed out and wiped (offline sign-out works).

## 7. Sign-out inside Clerk's profile screen

- [ ] Settings → your name → Manage account → sign out from there. The same wipe happens (check Study ticks and Jump Back In are empty) without using the Settings button.

## 8. Account switch on a shared phone

- [ ] Sign in as **A**, tick topics, cast a vote, sign out.
- [ ] Sign in as **B** (different account). B sees **none** of A's ticks, recents, vote highlights, or searches.
- [ ] B ticks a topic. Sign out, sign in as A: A sees A's data only.

## 9. Interrupted wipe

- [ ] Sign out, and immediately force-stop the app (swipe it away) within a second.
- [ ] Reopen: the app is clean (no previous user's data), and no onboarding. (The wipe finishes at launch.)

## 10. Sync toggle off

- [ ] Signed in, Settings → turn **Sync progress** off. Tick a topic: it works locally; no "waiting" count.
- [ ] Turn it on: the tick syncs.
- [ ] With sync off, Settings → Sign out message says progress will **not** be kept anywhere. Sign-out still wipes.

## 11. The risky one: offline cold start (do this carefully)

Clerk may report "signed out" when the phone is offline right after the app starts.

- [ ] Signed in as A with at least 1 **unsynced** tick (airplane mode, tick one topic).
- [ ] Force-stop the app, keep airplane mode **on**, reopen.
- [ ] **Expected:** you are still signed in (or at least the unsynced tick is **not** wiped). Note exactly what the app shows: ______________
- [ ] Turn airplane mode off: the tick syncs.
- [ ] Repeat once with **no** unsynced ticks and airplane mode on. Note whether you stay signed in: ______________
- [ ] If any case wiped data while merely offline, **stop and report it**; the launch-time wipe rule needs changing before release.

## 12. Renamed subject (needs admin access)

- [ ] Tick topics in a subject. In the admin MCP, rename that subject's slug.
- [ ] Open the subject in the app: the ticks are still there.
- [ ] A second device on the old app/cache still syncs (no "unknown subject" errors).

## 13. Push notifications

- [ ] Allow notifications. Send a **broadcast** from the admin tool: the phone receives it.
- [ ] `send_notification` with `dryRun: true` and your email: reports `recipients: 1` while signed in.
- [ ] Send a real targeted push to your email: arrives on this phone.
- [ ] Sign out, repeat the dry run for the same email: `recipients: 0`, `usersWithoutDevice: 1`.
- [ ] A **broadcast** still reaches the signed-out phone.
- [ ] Sign in as B: a push targeted at A does **not** arrive; one targeted at B does.

## 14. Account deletion (use a throwaway account)

- [ ] Make account C, tick topics, vote on a solution, vote on a note.
- [ ] Delete C inside the app (Manage account). The phone is wiped locally.
- [ ] In MongoDB, confirm C's rows are gone: `userprogresses`, `notevotes`, `notereports`, `solutionvotes`, `aioverviewlogs`, and the push token's `voterId` is unset.
- [ ] Clerk shows the webhook delivery succeeded (200).

## 15. Personalised MCP (optional)

- [ ] Connect an MCP client to `https://api.pyqdeck.in/mcp` and sign in as A.
- [ ] Ask "what's my progress?": it lists subjects with percentages matching the app.
- [ ] Ask it to mark one topic done: the tick shows up in the app after **Sync now**.

## 16. Settings follow the account

Needs two devices (or one device plus an emulator) signed in as the same account A.

- [ ] Device 1: in Settings change the **Ask AI engine** (e.g. to Claude), the **question reading layout** (Accordion to Cards) and the **volume-button scroll** switch. Wait a few seconds (or tap **Sync now**).
- [ ] Device 2: sign in as A (or bring the app to the foreground if already signed in). After a sync, Settings shows the same engine, layout and volume switch. Opening a question uses the Cards layout.
- [ ] Device 2 does **not** show the "choose your reading layout" first-time prompt (the account already has a choice).
- [ ] Device 1: pick a different **branch** in the Syllabus tab. Device 2 shows the same branch selected after a sync.
- [ ] Change one setting on device 2: it shows up on device 1 after its next sync.
- [ ] Offline: change the engine, kill the app, go online. The change reaches the account (check on the other device).
- [ ] Signed out, change a setting: it works and stays on the device. Sign in to an account that has never chosen: that device's choice is saved to the account.
- [ ] Sign out: the Ask AI engine goes back to Coursify (default); the reading layout and volume switch are kept.

## 17. Jump Back In across devices

- [ ] Device 1: open two or three subjects and read one study note. Home shows them under Jump Back In.
- [ ] Device 2: sign in as A. After a sync, the same recent subjects and note appear on Home (no need to restart).
- [ ] Open a different subject on device 2: after syncs, it appears at the top on device 1 too. The list never shows more than 4 subjects and 2 notes.
- [ ] Sign out on device 1: Jump Back In is empty. Sign back in: the account's recents return.
- [ ] Sign in as account B on a shared phone: B sees none of A's recents.

## 18. Regression sweep

- [ ] Papers, question detail, solutions, Ask AI, search, notes, settings still behave as before.
- [ ] "Clear cached data" in Settings clears the cache but **keeps** your progress.
- [ ] No crash on launch (the R8 crash from build 44 must not return).
- [ ] No new errors in Sentry for the session.

---

## Sign-off

- [ ] Sections 1 to 10, 13, 16 and 17 pass.
- [ ] Section 11 reviewed and the offline cold start is safe.
- [ ] Google Play **Data Safety** form updated (progress, votes, reports collected and linked to the account).
- [ ] Privacy policy page is live and mentions synced progress and app preferences.

Notes / failures:

