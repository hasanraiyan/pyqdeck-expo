import { useSyncExternalStore } from 'react';
import { getAppConfigNow, subscribeAppConfig } from './appConfig';
import type { AppConfig } from './appConfigLogic';

/** The current remote config; re-renders when a refresh changes it. */
export function useAppConfig(): AppConfig {
  return useSyncExternalStore(subscribeAppConfig, getAppConfigNow, getAppConfigNow);
}
