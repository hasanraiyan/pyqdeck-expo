import type { RewardedAd as RewardedAdType } from 'react-native-google-mobile-ads';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  adsAvailable,
} from './mobileAds';
import { AD_UNIT_IDS } from '../config/ads';
import { areAdsEnabled } from './adsEntitlement';

/**
 * Watch-to-unlock rewarded ads (docs/SRS-original-paper-viewer.md, FR-PAPER-17).
 *
 * `showRewardedAd()` resolves true only when the student watched enough to earn
 * the reward (EARNED_REWARD). Closed early, load/show failure, missing module
 * or missing unit ID, and ad-free/kill-switched users resolve through the
 * fail-open path instead - content is never blocked by an ad problem.
 *
 * One preloaded instance at a time; a fresh one loads after every close so the
 * next unlock is instant. All failures are silent to the caller except the
 * boolean verdict.
 */

export type RewardedVerdict = 'earned' | 'dismissed' | 'unavailable';

let rewarded: ReturnType<typeof RewardedAdType.createForAdRequest> | null = null;
let loaded = false;
let earning = false;

// Session unlocks: papers already paid for with a watch while the app is
// alive (`subjectId:year`). In-memory only - a restart asks again. Going back
// by accident must never cost a second ad.
const unlockedKeys = new Set<string>();

/** True when this paper was already unlocked by a watch this session. */
export function isPaperUnlocked(key: string): boolean {
  return unlockedKeys.has(key);
}

/** Records a completed watch so reopening skips the ad this session. */
export function markPaperUnlocked(key: string): void {
  unlockedKeys.add(key);
}

function createAndLoad(): void {
  if (!adsAvailable || !RewardedAd || !AD_UNIT_IDS.rewarded) return;
  try {
    rewarded = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded);
  } catch {
    rewarded = null;
    return;
  }
  loaded = false;
  earning = false;
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded = true;
  });
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    earning = true;
  });
  try {
    rewarded.load();
  } catch {
    // Never let an ad failure affect the app.
  }
}

/** Idempotent; call once at boot after mobileAds().initialize() resolves. */
export function initRewarded(): void {
  if (rewarded) return;
  createAndLoad();
}

const waitForLoad = (timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    if (loaded) return resolve(true);
    const started = Date.now();
    const timer = setInterval(() => {
      if (loaded || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(loaded);
      }
    }, 250);
  });

/**
 * Shows the rewarded ad and resolves the verdict. Ad-free users and the global
 * kill switch bypass the ad ('unavailable' - the caller opens directly).
 * Resolves 'earned' only on EARNED_REWARD; an early close resolves
 * 'dismissed' so the caller stays put.
 */
export async function showRewardedAd(): Promise<RewardedVerdict> {
  // Ad-free account or global kill switch: no ad, open straight through.
  if (!areAdsEnabled()) return 'unavailable';
  if (!adsAvailable || !RewardedAd || !AD_UNIT_IDS.rewarded) return 'unavailable';
  if (!rewarded) createAndLoad();
  if (!rewarded) return 'unavailable';

  // Wait briefly for the preload; a slow fill still beats blocking content.
  if (!(await waitForLoad(8000))) {
    createAndLoad();
    return 'unavailable';
  }

  earning = false;
  return new Promise<RewardedVerdict>((resolve) => {
    let settled = false;
    const done = (v: RewardedVerdict) => {
      if (settled) return;
      settled = true;
      clearTimeout(safety);
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
      // Fresh ad for the next unlock, whatever happened.
      loaded = false;
      createAndLoad();
      resolve(v);
    };
    // Safety net: never leave the caller hanging on a missing CLOSED event.
    const safety = setTimeout(() => done(earning ? 'earned' : 'dismissed'), 120_000);
    const unsubs = [
      rewarded!.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earning = true;
      }),
      // Close/error ride the shared AdEventType channel (RewardedAdEventType
      // only carries LOADED and EARNED_REWARD).
      rewarded!.addAdEventListener(AdEventType.CLOSED, () => {
        done(earning ? 'earned' : 'dismissed');
      }),
      rewarded!.addAdEventListener(AdEventType.ERROR, () => {
        done('unavailable');
      }),
    ];
    try {
      void rewarded!.show();
    } catch {
      done('unavailable');
    }
  });
}
