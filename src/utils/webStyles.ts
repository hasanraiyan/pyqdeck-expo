import { Platform } from 'react-native';
import { COLORS } from '../theme/colors';

let installed = false;

/**
 * Hover and keyboard-focus affordances for web / desktop (FR-C2).
 *
 * The app has ~230 TouchableOpacity, which carry no hover or focus styling.
 * react-native-web renders every focusable one as an element with
 * tabindex="0", so a single stylesheet covers all of them instead of
 * rewriting each into a Pressable. Hover is limited to fine pointers and focus
 * to :focus-visible, so touch screens and mouse clicks look exactly as before.
 */
export function installWebStyles() {
  if (installed || Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  const style = document.createElement('style');
  style.setAttribute('data-pyqdeck', 'interaction');
  style.textContent = `
[tabindex="0"] { transition: filter 120ms ease; }
@media (hover: hover) and (pointer: fine) {
  [tabindex="0"]:not(input):not(textarea):hover { filter: brightness(0.96); }
}
[tabindex="0"]:focus-visible {
  outline: 2px solid ${COLORS.primary};
  outline-offset: 2px;
}
`;
  document.head.appendChild(style);
}
