import AsyncStorage from '@react-native-async-storage/async-storage';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '../config/ads';

const OPENS_KEY = 'interstitial_opens_since_last_shown';
const LAST_SHOWN_KEY = 'interstitial_last_shown_at';
const OPENS_BEFORE_SHOW = 3;
const COOLDOWN_MS = 60 * 1000;

let interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial);
let loaded = false;

interstitial.addAdEventListener(AdEventType.LOADED, () => {
  loaded = true;
});
interstitial.addAdEventListener(AdEventType.CLOSED, () => {
  loaded = false;
  interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
  });
  interstitial.load();
});
interstitial.load();

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
 * Call each time a question detail screen is opened. Shows a preloaded
 * interstitial every OPENS_BEFORE_SHOW opens, no more than once per COOLDOWN_MS.
 */
export async function recordQuestionOpenedAndMaybeShowInterstitial() {
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

    if (loaded) {
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
