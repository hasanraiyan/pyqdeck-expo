import { useCallback, useRef } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

type VolumeDirection = 'up' | 'down';

function getModule(): { setEnabled: (value: boolean) => void } | null {
  try {
    return NativeModules.VolumeScrollModule ?? null;
  } catch {
    return null;
  }
}

/**
 * While the owning screen is focused, hardware volume buttons call `onPress`
 * instead of changing device volume. Android only - the native side (see
 * plugins/withVolumeScroll.js) isn't built for iOS. Every native touchpoint is
 * wrapped so this is a no-op on iOS, in Expo Go, or on any build that
 * predates the plugin (module missing) instead of throwing.
 */
export function useVolumeScroll(onPress: (direction: VolumeDirection) => void) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const volumeModule = getModule();
      if (!volumeModule) return;

      try {
        volumeModule.setEnabled(true);
      } catch {
        return;
      }

      const subscription = DeviceEventEmitter.addListener(
        'onVolumeButtonPress',
        (direction: VolumeDirection) => {
          try {
            onPressRef.current(direction);
          } catch {}
        }
      );

      return () => {
        subscription.remove();
        try {
          volumeModule.setEnabled(false);
        } catch {}
      };
    }, [])
  );
}
