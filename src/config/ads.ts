import { TestIds } from 'react-native-google-mobile-ads';

// TEMPORARY: forced to test IDs everywhere so ads are visible while the
// AdMob account/app is still pending Google's review. Real unit IDs are
// ca-app-pub-6179737775385101/2841064525 (banner) and
// ca-app-pub-6179737775385101/3967227754 (interstitial) - restore the
// __DEV__ split below once the account is approved and serving fill.
export const AD_UNIT_IDS = {
  banner: TestIds.BANNER,
  interstitial: TestIds.INTERSTITIAL,
};
