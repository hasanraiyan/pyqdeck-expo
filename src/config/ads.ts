import { TestIds } from 'react-native-google-mobile-ads';

// Test unit IDs always fill and are safe to click, so dev/debug builds use
// those and only release builds (__DEV__ === false) serve real ads.
export const AD_UNIT_IDS = {
  banner: __DEV__ ? TestIds.BANNER : 'ca-app-pub-6179737775385101/2841064525',
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-6179737775385101/3967227754',
};
