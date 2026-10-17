import { Platform, UIManager } from 'react-native';

/**
 * Safely enables LayoutAnimation on Android when running on the Old Architecture.
 * In the New Architecture (Fabric), LayoutAnimation is supported out of the box
 * and calling setLayoutAnimationEnabledExperimental produces a warning.
 */
export function enableLayoutAnimation(): void {
  if (
    Platform.OS === 'android' &&
    !(global as any).nativeFabricUIManager &&
    typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
  ) {
    try {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    } catch {
      // Ignore in environments where UIManager does not support this
    }
  }
}
