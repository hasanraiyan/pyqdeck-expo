const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// expo-build-properties (SDK 57) has no option for full R8 optimization or
// optimized resource shrinking, which Play Console flags. Both are small
// generated-file tweaks, applied at prebuild so they survive `expo prebuild --clean`.

const OPTIMIZED_SHRINKING_KEY = 'android.r8.optimizedResourceShrinking';

function withOptimizedProguardFile(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes('proguard-android-optimize.txt')) return cfg;
    if (!contents.includes('getDefaultProguardFile("proguard-android.txt")')) {
      throw new Error(
        'withR8Optimization: could not find getDefaultProguardFile("proguard-android.txt") in android/app/build.gradle'
      );
    }
    cfg.modResults.contents = contents.replace(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );
    return cfg;
  });
}

function withOptimizedResourceShrinking(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === OPTIMIZED_SHRINKING_KEY)
    );
    cfg.modResults.push({ type: 'property', key: OPTIMIZED_SHRINKING_KEY, value: 'true' });
    return cfg;
  });
}

// Strips non-English locale strings bundled by transitive SDKs
// (Google Play Services, Firebase, Clerk, AndroidX) to reduce release APK/AAB size.
function withEnglishOnlyResources(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("resourceConfigurations += ['en']")) return cfg;
    if (contents.includes('defaultConfig {')) {
      contents = contents.replace(
        'defaultConfig {',
        "defaultConfig {\n        resourceConfigurations += ['en']"
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withR8Optimization(config) {
  config = withOptimizedProguardFile(config);
  config = withOptimizedResourceShrinking(config);
  return withEnglishOnlyResources(config);
};
