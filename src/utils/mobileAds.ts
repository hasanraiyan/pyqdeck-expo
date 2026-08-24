/**
 * react-native-google-mobile-ads throws at import time (not at call time) when
 * its native module isn't in the running binary -- Expo Go, or a dev client
 * built before this dependency/config was added. A plain try/catch inside a
 * function body can't catch that; the require() itself has to be guarded.
 * Every other ads file should import from here, never from the package directly.
 */
let mod: typeof import('react-native-google-mobile-ads') | null = null;
try {
  mod = require('react-native-google-mobile-ads');
} catch {
  mod = null;
}

export const adsAvailable = mod !== null;

export const mobileAds = mod?.default ?? (() => ({ initialize: async () => {} }));
export const BannerAd = mod?.BannerAd ?? null;
export const BannerAdSize = mod?.BannerAdSize ?? ({} as typeof import('react-native-google-mobile-ads').BannerAdSize);
export const TestIds = mod?.TestIds ?? ({ BANNER: '', INTERSTITIAL: '' } as typeof import('react-native-google-mobile-ads').TestIds);
export const InterstitialAd = mod?.InterstitialAd ?? null;
export const AdEventType = mod?.AdEventType ?? ({} as typeof import('react-native-google-mobile-ads').AdEventType);
