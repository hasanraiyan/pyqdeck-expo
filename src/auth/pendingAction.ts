/**
 * A single action parked while the user signs in.
 *
 * Module-level rather than context/state on purpose: the sign-in sheet is
 * pushed on top of the current screen, so the screen that parked the action
 * stays mounted and its refs stay valid - there is nothing to serialise, and
 * a re-render would only risk stale closures.
 *
 * Only one action is held. A second guard() before signing in replaces the
 * first, which is the behaviour you want: the user's most recent tap is the
 * one they meant.
 */
let pending: (() => void) | null = null;

export const setPendingAction = (fn: () => void) => {
  pending = fn;
};

/** Returns the parked action and clears it, so it can only ever run once. */
export const takePendingAction = (): (() => void) | null => {
  const fn = pending;
  pending = null;
  return fn;
};

export const clearPendingAction = () => {
  pending = null;
};
