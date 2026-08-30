import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import { setPendingAction, takePendingAction } from './pendingAction';

/**
 * Gate for the features that need an account - voting, and later the AI tutor.
 * Everything else in this app (browsing papers, syllabus, search, reading
 * solutions) stays open to signed-out users and must never call this.
 *
 * `guard(run)` either runs the action immediately, or parks it, sends the user
 * to the sign-in sheet, and runs it once they come back signed in. That resume
 * is the point: a student who taps upvote should end up having voted, not
 * staring at a screen where their tap silently did nothing.
 */
export const useRequireAuth = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const navigation = useNavigation<any>();
  const wasSignedIn = useRef(false);

  // Fire the parked action on the signed-out -> signed-in edge only, so an
  // already-signed-in screen mounting later never re-runs someone's old tap.
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !wasSignedIn.current) {
      // takePendingAction clears as it reads, so if several screens are
      // mounted (a list behind a detail screen, say) only one of them runs it.
      takePendingAction()?.();
    }
    wasSignedIn.current = !!isSignedIn;
  }, [isLoaded, isSignedIn]);

  const guard = useCallback(
    (run: () => void, reason: 'vote' | 'report' | 'ai' = 'vote') => {
      // Clerk not resolved yet - treat as signed out rather than blocking on
      // it. A cold start still reading the token cache would otherwise make
      // the button feel dead for a few hundred ms.
      if (isLoaded && isSignedIn) {
        run();
        return;
      }
      setPendingAction(run);
      navigation.navigate('SignIn', { reason });
    },
    [isLoaded, isSignedIn, navigation]
  );

  return { isSignedIn: isLoaded && isSignedIn, isLoaded, guard };
};
