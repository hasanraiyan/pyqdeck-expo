import { Alert } from 'react-native';
import { CommunityApiError, isAbortError } from '@pyqdeck/community-sdk';

/** A student-friendly sentence for any failure from the Community API. */
export function describeCommunityError(err: unknown): string {
  if (err instanceof CommunityApiError) {
    if (err.isNetworkError) return err.message;
    if (err.isUnauthorized) return 'Please sign in to do this.';
    if (err.isRateLimited) {
      const secs = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : null;
      const wait = secs ? (secs >= 60 ? `${Math.ceil(secs / 60)} min` : `${secs}s`) : 'a little while';
      return `You're doing that too fast. Try again in ${wait}.`;
    }
    if (err.status === 403) return err.message || "You can't do this right now.";
    if (err.status >= 500) return 'Community is having trouble right now. Please try again shortly.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Shows a failure as an alert, unless the person cancelled the request themselves. */
export function alertCommunityError(err: unknown, title = 'Could not complete that'): void {
  if (isAbortError(err)) return;
  Alert.alert(title, describeCommunityError(err));
}
