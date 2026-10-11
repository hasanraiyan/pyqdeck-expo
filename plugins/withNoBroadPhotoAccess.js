const { withAndroidManifest } = require('expo/config-plugins');

// Google Play's Photo & Video Permissions policy: broad gallery access
// (READ_MEDIA_IMAGES / READ_MEDIA_VIDEO) is reserved for apps whose core
// functionality needs it, with a console declaration to prove it. Our only
// gallery use is admins uploading paper scans - infrequent, and served by the
// system photo picker (permission-free on Android 13+). So these manifest
// entries, which expo-image-picker adds, must go; otherwise every release is
// met with Play's core-functionality declaration demand.
//
// Runs at `expo prebuild` (see AGENTS.md). Must stay AFTER expo-image-picker
// in app.json's plugins list so the removal wins.
const BLOCKED = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

module.exports = function withNoBroadPhotoAccess(config) {
  return withAndroidManifest(config, (config) => {
    const perms = config.modResults.manifest['uses-permission'];
    if (Array.isArray(perms)) {
      const kept = perms.filter((e) => !BLOCKED.includes(e.$?.['android:name']));
      if (kept.length !== perms.length) {
        console.log(
          `[withNoBroadPhotoAccess] removed: ${perms
            .filter((e) => BLOCKED.includes(e.$?.['android:name']))
            .map((e) => e.$['android:name'])
            .join(', ')}`
        );
      }
      config.modResults.manifest['uses-permission'] = kept;
    }
    return config;
  });
};
