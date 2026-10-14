import * as Font from 'expo-font';
import { Kalam_700Bold } from '@expo-google-fonts/kalam/700Bold';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand/400Regular';

// The handwritten faces used only by the notes' SVG diagrams (see
// sanitizeSvgForNative). They are not needed for the first screen, so the app
// loads them after launch instead of holding the first render for them, and a
// diagram waits on this before it draws so its text never shows in a fallback font.
let pending: Promise<void> | null = null;

export function loadNoteFonts(): Promise<void> {
  if (!pending) {
    pending = Font.loadAsync({ Kalam_700Bold, PatrickHand_400Regular }).catch(() => {
      // Let the next diagram try again; it draws in the system font meanwhile.
      pending = null;
    });
  }
  return pending;
}
