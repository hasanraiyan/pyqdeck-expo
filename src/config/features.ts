/**
 * Feature flags - flip and ship a new build to enable.
 * Syllabus is hidden until the syllabus data is uploaded.
 */
export const isSyllabusEnabled = true;

/**
 * Auth (Clerk). On: AI chat requires an account, and voting is gated behind
 * sign-in (with auth off, useRequireAuth never runs a vote). It was off on
 * master for Google Play Store review compliance - before shipping a build
 * with this on, run the checklist in docs/SRS-ai-chat-streaming.md section 3.9
 * (release-build smoke test with the Clerk R8 keep rules, in-app account
 * deletion, Data Safety form, privacy policy).
 */
export const isAuthEnabled = true;

/**
 * Ask AI - enable/disable Ask AI buttons across the app.
 */
export const isAiEnabled = true;
