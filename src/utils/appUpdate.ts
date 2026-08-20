import { Platform } from 'react-native';
import type { StatusUpdateEvent } from 'sp-react-native-in-app-updates';

/**
 * Checks the Play Store (Android) / App Store (iOS) for a newer published version and,
 * if one exists, prompts the user to update. Android uses Play Core's flexible in-app
 * update (downloads in the background, installs once ready - non-blocking). iOS has no
 * embedded-download equivalent, so it shows a native alert linking out to the App Store.
 *
 * The native module isn't present in Expo Go (or any build that hasn't been rebuilt with
 * it linked in), and importing it there throws at import time rather than on first call -
 * so it's loaded lazily inside this try/catch instead of via a top-level import, keeping
 * that case a silent no-op instead of crashing app startup.
 */
export async function checkForStoreUpdate() {
  try {
    const { default: SpInAppUpdates, IAUUpdateKind, IAUInstallStatus } = await import(
      'sp-react-native-in-app-updates'
    );
    const inAppUpdates = new SpInAppUpdates(false);

    const result = await inAppUpdates.checkNeedsUpdate();
    if (!result.shouldUpdate) return;

    if (Platform.OS === 'android') {
      const onStatusUpdate = (status: StatusUpdateEvent) => {
        if (status.status === IAUInstallStatus.DOWNLOADED) {
          inAppUpdates.installUpdate();
          inAppUpdates.removeStatusUpdateListener(onStatusUpdate);
        }
      };
      inAppUpdates.addStatusUpdateListener(onStatusUpdate);
      await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
    } else {
      await inAppUpdates.startUpdate({});
    }
  } catch {
    // No-op: native module unavailable (e.g. Expo Go) or the check itself failed.
  }
}
