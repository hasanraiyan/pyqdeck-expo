import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InterstitialAd as InterstitialAdType } from 'react-native-google-mobile-ads';
import { InterstitialAd, AdEventType, adsAvailable } from './mobileAds';
import { AD_UNIT_IDS } from '../config/ads';

const OPENS_KEY = 'interstitial_opens_since_last_shown';
const LAST_SHOWN_KEY = 'interstitial_last_shown_at';
const OPENS_BEFORE_SHOW = 3;
const COOLDOWN_MS = 60 * 1000;

let interstitial: ReturnType<typeof InterstitialAdType.createForAdRequest> | null = null;
let loaded = false;

function createAndLoadInterstitial() {
  if (!adsAvailable || !InterstitialAd) return;
  interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    loaded = false;
    createAndLoadInterstitial();
  });
  interstitial.load();
}
createAndLoadInterstitial();

async function getState(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setState(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

/**
 * Call each time a content screen is opened - a question detail, or a syllabus
 * for a semester. Shows a preloaded interstitial every OPENS_BEFORE_SHOW opens,
 * no more than once per COOLDOWN_MS.
 *
 * The counter is shared across screen types on purpose: the cap exists to limit
 * how often a student sees a full-screen ad, and that budget is per student,
 * not per feature. A per-screen counter would multiply the ads by the number of
 * screens that opt in, which is how an app ends up flagged for ad frequency.
 */
export async function recordContentOpenedAndMaybeShowInterstitial() {
  try {
    const opens = Number((await getState(OPENS_KEY)) ?? '0') + 1;

    if (opens < OPENS_BEFORE_SHOW) {
      await setState(OPENS_KEY, String(opens));
      return;
    }

    const lastShown = Number((await getState(LAST_SHOWN_KEY)) ?? '0');
    if (Date.now() - lastShown < COOLDOWN_MS) {
      await setState(OPENS_KEY, String(opens));
      return;
    }

    if (loaded && interstitial) {
      await setState(OPENS_KEY, '0');
      await setState(LAST_SHOWN_KEY, String(Date.now()));
      await interstitial.show();
    } else {
      await setState(OPENS_KEY, String(opens));
    }
  } catch {
    // Never let an ad failure affect navigation.
  }
}

/** @deprecated Use recordContentOpenedAndMaybeShowInterstitial. */
export const recordQuestionOpenedAndMaybeShowInterstitial =
  recordContentOpenedAndMaybeShowInterstitial;
