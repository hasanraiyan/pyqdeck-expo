import * as TaskManager from 'expo-task-manager';
import { SYNC_NUDGE_TASK } from './taskNames';
import { syncFromBackground } from '../db/progressSync';
import { recordNudgeRun } from './diagnostics';

/**
 * Headless handler for the server's "sync now" nudge: a data-only push sent to
 * a student's other devices when one device changed their progress. It runs even
 * with the app closed, so a tick on one phone can show up on the other without
 * anyone opening it.
 *
 * Must be defined at module scope of a file required early (index.ts). It is
 * best effort: the OS may skip it (Doze, battery limits), and the app syncs on
 * every foreground anyway, so a missed nudge only means "later", never "lost".
 */

// The Android payload for a data-only message carries the Expo `data` as a JSON
// string in a field whose exact name differs between versions, so look for the
// marker in the serialised payload rather than in one fixed place.
const isSyncNudge = (payload: unknown): boolean => {
  try {
    return /"type"\s*:\s*"sync"|\\"type\\"\s*:\s*\\"sync\\"/.test(JSON.stringify(payload));
  } catch {
    return false;
  }
};

TaskManager.defineTask(SYNC_NUDGE_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (!isSyncNudge(data)) {
    // The task also fires for ordinary pushes; only nudges are interesting.
    return;
  }
  try {
    await recordNudgeRun('headless', `received, ${await syncFromBackground()}`);
  } catch (e) {
    await recordNudgeRun('headless', `error: ${(e as Error)?.message ?? 'unknown'}`);
  }
});
