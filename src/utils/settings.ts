import AsyncStorage from '@react-native-async-storage/async-storage';
import { markSettingPending } from '../db/settingsPending';

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
  await markSettingPending('volumeScroll');
}

const OLD_UI_ENABLED_KEY = 'old_ui_enabled';
const QUESTION_LAYOUT_CHOSEN_KEY = 'question_layout_chosen';

// The layout is read from disk, which is async. Kept in memory once known so a
// screen can start in the right layout on its first frame instead of drawing
// the default and then switching.
let oldUiCache: boolean | null = null;

/** The saved layout if it has already been read this session, else null. */
export function peekOldUiEnabled(): boolean | null {
  return oldUiCache;
}

export async function getOldUiEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(OLD_UI_ENABLED_KEY);
    oldUiCache = raw === '1';
  } catch {
    oldUiCache = false;
  }
  return oldUiCache;
}

export async function setOldUiEnabled(value: boolean): Promise<void> {
  oldUiCache = value;
  try {
    await AsyncStorage.setItem(OLD_UI_ENABLED_KEY, value ? '1' : '0');
    await AsyncStorage.setItem(QUESTION_LAYOUT_CHOSEN_KEY, '1');
  } catch {}
  await markSettingPending('readingLayout');
}

/**
 * Applies the layout stored on the account without marking it as a local
 * change (it is already in sync). Also counts as "chosen", so the first-time
 * layout prompt does not ask a student who already picked on another phone.
 */
export async function applyOldUiFromAccount(value: boolean): Promise<void> {
  oldUiCache = value;
  try {
    await AsyncStorage.setItem(OLD_UI_ENABLED_KEY, value ? '1' : '0');
    await AsyncStorage.setItem(QUESTION_LAYOUT_CHOSEN_KEY, '1');
  } catch {}
}

/**
 * Checks whether the user has already chosen their preferred question layout
 * (via the first-time prompt or by explicitly toggling it in Settings).
 */
export async function hasChosenQuestionLayout(): Promise<boolean> {
  try {
    const chosen = await AsyncStorage.getItem(QUESTION_LAYOUT_CHOSEN_KEY);
    if (chosen === '1') return true;
    // If the user already explicitly set old_ui_enabled in the past, treat as chosen
    const oldUi = await AsyncStorage.getItem(OLD_UI_ENABLED_KEY);
    return oldUi !== null;
  } catch {
    return true; // Fail safe on storage error so users are not blocked
  }
}

/**
 * Marks that the user has chosen their question reading layout,
 * preventing the first-time prompt from appearing again.
 */
export async function markQuestionLayoutChosen(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUESTION_LAYOUT_CHOSEN_KEY, '1');
  } catch {}
}

const SELECTED_BRANCH_KEY = 'selected_syllabus_branch';

export async function getSelectedBranch(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_BRANCH_KEY);
    return raw || 'cse';
  } catch {
    return 'cse';
  }
}

export async function setSelectedBranch(branchId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_BRANCH_KEY, branchId);
  } catch {}
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

/** Whether the laptop/desktop sidebar is collapsed to the icon rail. Defaults to expanded. */
export async function getSidebarCollapsed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SIDEBAR_COLLAPSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setSidebarCollapsed(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0');
  } catch {}
}
