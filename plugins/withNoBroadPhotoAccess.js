const { withAndroidManifest } = require('expo/config-plugins');

// Google Play's Photo & Video Permissions policy: broad gallery access
// (READ_MEDIA_IMAGES / READ_MEDIA_VIDEO) is reserved for apps whose core
// functionality needs it, with a console declaration to prove it. Our only
// gallery use is admins uploading paper scans - infrequent, and served by the
// system photo picker (permission-free on Android 13+). So these permissions
// must not reach the final manifest.
//
// Some come from expo-image-picker (app manifest) and some from library
// manifests merged by Gradle (e.g. expo-screen-capture), which this plugin
// cannot see. So each blocked permission is rewritten as a
// tools:node="remove" entry, which also strips the merged library ones.
//
// Runs at `expo prebuild` (see AGENTS.md). Must stay AFTER expo-image-picker
// in app.json's plugins list so the rewrite wins.
const BLOCKED = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

module.exports = function withNoBroadPhotoAccess(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const perms = (manifest['uses-permission'] ??= []);
    for (const name of BLOCKED) {
      const existing = perms.find((e) => e.$?.['android:name'] === name);
      if (existing) {
        existing.$['tools:node'] = 'remove';
      } else {
        perms.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
      }
    }
    return config;
  });
};
