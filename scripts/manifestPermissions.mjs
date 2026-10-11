// Permissions that must never reach a release build.
//
// Google Play restricts broad photo/video access (READ_MEDIA_IMAGES /
// READ_MEDIA_VIDEO and the partial-access variant): an app that requests them
// has to justify it in a Play Console declaration, and a library can add them
// to the merged manifest without us ever seeing it (expo-screen-capture did).
// The app picks images through the system photo picker, which needs none of them.
//
// Add a name here to forbid it too.
export const FORBIDDEN_PERMISSIONS = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

const TAG = /<uses-permission(?:-sdk-23)?\b[^>]*>/g;
const NAME = /android:name\s*=\s*"([^"]+)"/;
const REMOVED = /tools:node\s*=\s*"remove"/;

/**
 * Forbidden permissions a manifest actually requests. Entries marked
 * tools:node="remove" are the app asking the merger to strip a permission, so
 * they are not requests and are ignored (they appear in the source manifest,
 * never in the merged one).
 */
export function forbiddenPermissions(xml, forbidden = FORBIDDEN_PERMISSIONS) {
  const found = new Set();
  for (const tag of String(xml).match(TAG) ?? []) {
    if (REMOVED.test(tag)) continue;
    const name = NAME.exec(tag)?.[1];
    if (name && forbidden.includes(name)) found.add(name);
  }
  return [...found];
}
