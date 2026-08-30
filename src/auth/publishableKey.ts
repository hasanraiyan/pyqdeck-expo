import Constants from 'expo-constants';

/**
 * The Clerk publishable key, resolved once for the whole app.
 *
 * Two sources, in order:
 *   1. EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY - local override, from .env.local
 *   2. app.json expo.extra.clerkPublishableKey - the committed default
 *
 * The app.json fallback exists because .env.local is gitignored and the
 * release workflow has no step that supplies it, so a CI build would resolve
 * `undefined` and break auth in every shipped APK.
 *
 * Committing the key is safe: Clerk publishable keys are public by design and
 * are already extractable from any shipped APK. Only the secret key, which
 * lives on the server, has to stay private.
 */
export const clerkPublishableKey: string =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ||
  '';
