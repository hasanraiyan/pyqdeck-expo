import { Linking } from 'react-native';
import Constants from 'expo-constants';

export async function checkForStoreUpdate() {
  // Store in-app update check placeholder
}

function getAndroidPackage(): string {
  return Constants.expoConfig?.android?.package || 'app.hasanraiyan.pyqdeck';
}

/**
 * Opens the app's Play Store listing so the user can see if an update is
 * available (Play Store shows "Update" vs "Open" itself - this app has no
 * OTA/in-app-update integration, so it doesn't claim to know the answer).
 * Tries the native Play Store app first, falls back to the web listing.
 */
export async function openStoreListing(): Promise<void> {
  const pkg = getAndroidPackage();
  const marketUrl = `market://details?id=${pkg}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${pkg}`;
  try {
    await Linking.openURL(marketUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch {}
  }
}
