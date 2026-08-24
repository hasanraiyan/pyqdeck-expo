import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

// Guarded require, same pattern as mobileAds.ts - the native module isn't
// present in Expo Go or a build that predates this dependency, and a plain
// try/catch inside a function body can't catch a throw from require()
// itself.
let SpInAppUpdates: any = null;
let IAUUpdateKind: any = null;
try {
  const mod = require('sp-react-native-in-app-updates');
  SpInAppUpdates = mod.default;
  IAUUpdateKind = mod.IAUUpdateKind;
} catch {
  SpInAppUpdates = null;
}

function getAndroidPackage(): string {
  return Constants.expoConfig?.android?.package || 'app.hasanraiyan.pyqdeck';
}

export type UpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'no-update' }
  | { status: 'update-started' }
  | { status: 'failed' };

// Google Play's native In-App Updates API (Play Core) - checks whether a
// newer version is live on Play, and if so downloads it in the background
// (flexible update) without the user leaving the app. A flexible update
// still needs installUpdate() called once the download finishes to
// actually apply it; not wired up here since this is the passive/silent
// check called on every launch - a user who wants to force it through uses
// the interactive check below instead. Android only, and no-ops if the
// native module isn't in the running binary.
const performUpdateCheck = async (): Promise<UpdateCheckResult> => {
  if (Platform.OS !== 'android' || !SpInAppUpdates) {
    return { status: 'unsupported' };
  }

  try {
    const inAppUpdates = new SpInAppUpdates(false);
    const currentVersion = Constants.expoConfig?.version;
    const result = await inAppUpdates.checkNeedsUpdate(
      currentVersion ? { curVersion: currentVersion } : undefined
    );
    if (!result?.shouldUpdate) {
      return { status: 'no-update' };
    }

    await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
    return { status: 'update-started' };
  } catch (e) {
    console.error('In-app update check failed', e);
    return { status: 'failed' };
  }
};

// Silent, best-effort - called once on every app launch (App.tsx). Ignores
// the result; a flexible update that started just downloads quietly in the
// background.
export async function checkForStoreUpdate(): Promise<void> {
  await performUpdateCheck();
}

// Same check, but returns the result so the caller (Settings' manual
// "Check for updates" button) can show the user what happened.
export async function checkForUpdateInteractive(): Promise<UpdateCheckResult> {
  return performUpdateCheck();
}

/**
 * Opens the app's Play Store listing. Used as the rating-flow fallback, and
 * as the interactive update check's fallback when the native module isn't
 * available (unsupported/failed) - Play Store shows "Update" vs "Open"
 * itself in that case.
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
