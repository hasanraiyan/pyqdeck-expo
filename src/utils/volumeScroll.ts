import { useCallback, useRef } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVolumeScrollEnabled } from './settings';

type VolumeDirection = 'up' | 'down';

const HINT_SEEN_KEY = 'volume_scroll_hint_seen';

function getModule(): { setEnabled: (value: boolean) => void } | null {
  try {
    return NativeModules.VolumeScrollModule ?? null;
  } catch {
    return null;
  }
}

// Fires `onFirstUse` the very first time (ever, across app opens) volume
// scrolling actually triggers, so callers can surface a one-time explanation.
async function notifyIfFirstUse(onFirstUse?: () => void) {
  if (!onFirstUse) return;
  try {
    const seen = await AsyncStorage.getItem(HINT_SEEN_KEY);
    if (seen === '1') return;
    await AsyncStorage.setItem(HINT_SEEN_KEY, '1');
    onFirstUse();
  } catch {}
}

/**
 * While the owning screen is focused, hardware volume buttons call `onPress`
 * instead of changing device volume. Android only - the native side (see
 * plugins/withVolumeScroll.js) isn't built for iOS. Every native touchpoint is
 * wrapped so this is a no-op on iOS, in Expo Go, or on any build that
 * predates the plugin (module missing) instead of throwing.
 */
export function useVolumeScroll(
  onPress: (direction: VolumeDirection) => void,
  onFirstUse?: () => void
) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const onFirstUseRef = useRef(onFirstUse);
  onFirstUseRef.current = onFirstUse;
  const firstUseCheckedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const volumeModule = getModule();
      if (!volumeModule) return;

      let cancelled = false;
      let subscription: { remove: () => void } | null = null;

      (async () => {
        const enabled = await getVolumeScrollEnabled();
        if (cancelled || !enabled) return;

        try {
          volumeModule.setEnabled(true);
        } catch {
          return;
        }

        subscription = DeviceEventEmitter.addListener(
          'onVolumeButtonPress',
          (direction: VolumeDirection) => {
            try {
              onPressRef.current(direction);
            } catch {}

            if (!firstUseCheckedRef.current) {
              firstUseCheckedRef.current = true;
              notifyIfFirstUse(onFirstUseRef.current);
            }
          }
        );
      })();

      return () => {
        cancelled = true;
        subscription?.remove();
        try {
          volumeModule.setEnabled(false);
        } catch {}
      };
    }, [])
  );
}
