/**
 * The decisions the settings half of a sync round makes, kept pure so they can
 * be unit tested (the module that applies them touches AsyncStorage).
 *
 * Why this exists: "the account never chose this setting but this phone did, so
 * push it on the next round" had no way to stop when the account still did not
 * have the setting AFTER the push (a server that does not store it, or rejects
 * the value). With two such settings the rounds alternated forever: round 1
 * pushed X and re-marked Y, round 2 pushed Y and re-marked X, each round
 * scheduling the next ~2s after it ended. The phone then synced every few
 * seconds while idle. Two guards now stop that: a value is adopted at most once
 * (decideSettingAction's `alreadyTriedAdopt`), and no chain of follow-up rounds
 * can run past MAX_FOLLOW_UPS (nextFollowUps), whatever the cause.
 */

export type SettingAction =
  | 'settled' // pushed and still current: clear its pending mark
  | 'again' // pushed but changed since, or changed mid-flight: another round
  | 'adopt-remote' // the account has a different value: take it locally
  | 'clear-same' // first sync, same value on both sides: nothing pending
  | 'adopt-local' // the account never chose, this phone did: push ours next round
  | 'none';

export interface SettingInputs {
  /** This setting was part of the request just sent. */
  wasSent: boolean;
  sentValue: unknown;
  local: unknown;
  /** Marked pending now (changed on this phone, not necessarily sent). */
  stillPending: boolean;
  /** The account returned a valid value for it. */
  remoteSet: boolean;
  remoteValue: unknown;
  /** First sync for this account on this phone: the account's values win. */
  accountWins: boolean;
  /** We already tried pushing exactly this local value and the account still lacks it. */
  alreadyTriedAdopt: boolean;
}

export function decideSettingAction(i: SettingInputs): SettingAction {
  if (i.wasSent) return i.local === i.sentValue ? 'settled' : 'again';
  if (i.stillPending) return 'again';
  if (i.remoteSet && i.remoteValue !== i.local) return 'adopt-remote';
  if (i.remoteSet && i.accountWins) return 'clear-same';
  if (!i.remoteSet && i.local !== null) return i.alreadyTriedAdopt ? 'none' : 'adopt-local';
  return 'none';
}

/** Follow-up rounds ("one more round settles it") allowed in a row. */
export const MAX_FOLLOW_UPS = 3;

/**
 * After a round: how many follow-ups have run in a row, and whether one more may
 * be scheduled. A round that needs no follow-up ends the chain.
 */
export function nextFollowUps(
  followUps: number,
  needsAnotherRound: boolean,
  max: number = MAX_FOLLOW_UPS
): { followUps: number; schedule: boolean } {
  if (!needsAnotherRound) return { followUps: 0, schedule: false };
  if (followUps >= max) return { followUps, schedule: false };
  return { followUps: followUps + 1, schedule: true };
}
