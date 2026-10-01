import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether the list pane beside a detail screen (questions, study topics) is
// folded away to a thin strip. One shared flag, so folding it on one screen
// keeps it folded on the next, and it survives a restart.

const KEY = 'list_pane_collapsed';
let collapsed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1' && !collapsed) {
      collapsed = true;
      emit();
    }
  })
  .catch(() => {});

export function setPaneCollapsed(value: boolean) {
  collapsed = value;
  emit();
  AsyncStorage.setItem(KEY, value ? '1' : '0').catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function usePaneCollapsed() {
  const value = useSyncExternalStore(subscribe, () => collapsed, () => false);
  return [value, setPaneCollapsed] as const;
}
