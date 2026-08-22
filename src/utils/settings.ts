import AsyncStorage from '@react-native-async-storage/async-storage';

const VOLUME_SCROLL_ENABLED_KEY = 'volume_scroll_enabled';

/**
 * Defaults to true (matches the app's original always-on behavior) when
 * the user hasn't touched the Settings toggle yet.
 */
export async function getVolumeScrollEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VOLUME_SCROLL_ENABLED_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export async function setVolumeScrollEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VOLUME_SCROLL_ENABLED_KEY, value ? '1' : '0');
  } catch {}
}
