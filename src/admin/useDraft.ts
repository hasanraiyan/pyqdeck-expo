import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Unsaved editor text survives the app being killed, a crash, or the phone
// dropping off the network mid-edit. One slot per thing being edited
// ("notes:subject:topic"), written ~0.6s after the last keystroke and removed
// when the edit is saved or deliberately discarded.
//
// A draft is the admin's own unpublished work, so it is registered as user data
// (storageRegistry.ts) and wiped on sign-out. It is never uploaded.

const PREFIX = 'pyqdeck:draft:';
const SAVE_DELAY_MS = 600;

export interface Draft {
  text: string;
  savedAt: number;
}

async function readDraft(key: string): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return typeof d?.text === 'string' && typeof d?.savedAt === 'number' ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  AsyncStorage.removeItem(PREFIX + key).catch(() => {});
}

export { draftAge } from './draftLogic';

/**
 * Autosaves `current` while it differs from `baseline` (what is on the server)
 * and reports a draft left by an earlier session. Nothing is written while a
 * found draft is still waiting for Restore/Discard, so typing cannot overwrite it.
 */
export function useDraft(key: string, current: string, baseline: string) {
  const [found, setFound] = useState<Draft | null>(null);

  useEffect(() => {
    let alive = true;
    readDraft(key).then((d) => {
      if (alive && d && d.text !== baseline && d.text.trim()) setFound(d);
    });
    return () => {
      alive = false;
    };
    // Looked up once per thing being edited, not on every baseline change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (found || current === baseline) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(PREFIX + key, JSON.stringify({ text: current, savedAt: Date.now() })).catch(() => {});
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [key, current, baseline, found]);

  return {
    found,
    dismiss: () => {
      clearDraft(key);
      setFound(null);
    },
    accept: () => setFound(null),
    clear: () => clearDraft(key),
  };
}
