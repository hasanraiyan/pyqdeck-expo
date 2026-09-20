/**
 * Feature flags - flip and ship a new build to enable.
 * Syllabus is hidden until the syllabus data is uploaded.
 */
export const isSyllabusEnabled = true;

/**
 * Auth (Clerk) - disabled on master for Google Play Store review compliance.
 * Enabled on clerk-auth branch.
 */
export const isAuthEnabled = false;
