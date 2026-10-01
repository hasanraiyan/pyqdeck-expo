import type { ViewStyle } from 'react-native';
import { useResponsive } from './responsive';

const DIALOG_MAX_WIDTH = 520;

/**
 * Bottom sheets become centred dialogs from laptop width up (FR-L9): a
 * full-width sheet stuck to the bottom of a 1440 px window is hard to reach
 * and far from the pointer. On phone and tablet nothing changes.
 *
 * Spread the pieces *after* the sheet's own styles, e.g.
 * `style={[styles.sheet, dlg.sheet]}` and `animationType={dlg.animationType}`.
 */
export function useDialogLayout() {
  const { breakpoint } = useResponsive();
  const wide = breakpoint === 'laptop' || breakpoint === 'desktop';
  const overlay: ViewStyle | undefined = wide
    ? { justifyContent: 'center', alignItems: 'center', padding: 24 }
    : undefined;
  const sheet: ViewStyle | undefined = wide
    ? {
        width: '100%',
        maxWidth: DIALOG_MAX_WIDTH,
        alignSelf: 'center',
        // Per-corner: the sheets set their own top radii, which would win over borderRadius.
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingBottom: 18,
        maxHeight: '85%',
      }
    : undefined;
  return { wide, animationType: wide ? ('fade' as const) : ('slide' as const), overlay, sheet };
}
