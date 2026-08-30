import { useCallback } from 'react';
import { useAuth } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';

/**
 * Gate for the handful of features that cost real money to serve (the AI
 * tutor). Everything else in this app - browsing papers, syllabus, search,
 * solutions - stays open to signed-out users and must never call this.
 *
 * Returns a `guard(run)` that either runs the action straight away, or sends
 * the user to the sign-in sheet and drops the action. It deliberately does
 * NOT resume the action after a successful sign-in: the screens using this
 * re-render on `isSignedIn` anyway, so the user lands back on a screen whose
 * button now works, rather than having something fire under them.
 */
export const useRequireAuth = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const navigation = useNavigation<any>();

  const guard = useCallback(
    (run: () => void) => {
      // Clerk not resolved yet - treat as signed out rather than blocking on
      // it. A cold start where the token cache is still being read would
      // otherwise make the button feel dead for a few hundred ms.
      if (isLoaded && isSignedIn) {
        run();
        return;
      }
      navigation.navigate('SignIn', { reason: 'ai' });
    },
    [isLoaded, isSignedIn, navigation]
  );

  return { isSignedIn: isLoaded && isSignedIn, isLoaded, guard };
};
