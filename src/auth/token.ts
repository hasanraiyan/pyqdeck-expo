import { getClerkInstance } from '@clerk/expo';
import { clerkPublishableKey } from './publishableKey';

/**
 * Reads the current Clerk session token from outside React, for the API layer.
 *
 * Only the AI endpoints use this. Every other request in src/api/index.ts is
 * left exactly as it was - anonymous, no Authorization header - because the
 * papers, syllabus, search and solutions are free to signed-out users and
 * sending a token on those would be both pointless and a privacy regression.
 *
 * Returns null rather than throwing when signed out, so callers can decide
 * between prompting for sign-in and just proceeding anonymously.
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const clerk = getClerkInstance({ publishableKey: clerkPublishableKey });
    return (await clerk.session?.getToken()) ?? null;
  } catch {
    // Clerk not initialised yet, or offline with nothing cached. The caller
    // treats this the same as signed out.
    return null;
  }
};

/** Authorization header for an authed request, or `{}` when signed out. */
export const authHeader = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * The signed-in Clerk user id, readable without React - for the background
 * sync task, which runs headless with no ClerkProvider mounted. Returns null
 * whenever it cannot be told for sure (Clerk not loaded, offline, signed out),
 * and the caller then does nothing; the next time the app is opened it syncs
 * normally.
 */
export const getSignedInUserId = async (): Promise<string | null> => {
  try {
    const clerk: any = getClerkInstance({ publishableKey: clerkPublishableKey });
    if (!clerk.loaded && typeof clerk.load === 'function') await clerk.load();
    return clerk.session ? (clerk.user?.id ?? null) : null;
  } catch {
    return null;
  }
};
