import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyAdsEntitlement } from '../api';
import { getAppConfigNow } from '../config/appConfig';

/**
 * Per-account paid-ads entitlement (docs/SRS-advertisements.md, FR-ADS-13..19).
 *
 * The single question every ad surface asks is areAdsEnabled(): the global
 * kill switch AND NOT the account's ad-free flag. Signed-out devices have no
 * entitlement, so they always count as ads-eligible.
 *
 * Rules that keep it harmless (same shape as src/config/appConfig.ts):
 *  - never blocks startup or navigation: callers read the in-memory copy
 *    synchronously and refresh in the background;
 *  - fail-open: unknown (offline, error, signed out) means "show ads" -
 *    ad-free must be proven by a successful entitlement response;
 *  - the last good copy is stored per account, so it still applies offline,
 *    and it is registered as user data so sign-out wipes it.
 */

const ENTITLEMENT_KEY = 'pyqdeck:ads_entitlement';
const REFRESH_MIN_GAP_MS = 10 * 60 * 1000;

interface EntitlementState {
  /** Clerk user id this copy belongs to; null when signed out. */
  userId: string | null;
  adFree: boolean;
}

let current: EntitlementState = { userId: null, adFree: false };
let lastFetchAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const set = (next: EntitlementState) => {
  if (next.userId === current.userId && next.adFree === current.adFree) return;
  current = next;
  listeners.forEach((fn) => fn());
};

export const getAdsEntitlementNow = (): EntitlementState => current;

export const subscribeAdsEntitlement = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Reactive read for components (AdBanner re-renders when it resolves). */
export function useAdsEntitlement(): EntitlementState {
  return useSyncExternalStore(subscribeAdsEntitlement, getAdsEntitlementNow, getAdsEntitlementNow);
}

/**
 * The gate. Synchronous on purpose: ad decisions (banner render, interstitial
 * counting) must never wait on the network. The background refreshes in
 * App.tsx keep `current` fresh; until one lands, ads show (fail-open).
 */
export function areAdsEnabled(): boolean {
  if (getAppConfigNow().flags.adsEnabled === false) return false;
  return !current.adFree;
}

/** Reads the stored copy for this account. Cheap; called on sign-in. */
export async function loadCachedAdsEntitlement(userId: string): Promise<EntitlementState> {
  if (current.userId !== userId) set({ userId, adFree: false });
  try {
    const raw = await AsyncStorage.getItem(ENTITLEMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EntitlementState>;
      if (parsed?.userId === userId) set({ userId, adFree: parsed.adFree === true });
    }
  } catch {}
  return current;
}

/**
 * Fetches the entitlement in the background; at most once per 10 minutes
 * unless forced. Pass the signed-in user id, or omit it to refresh for
 * whichever account is currently loaded (no-op when signed out).
 */
export function refreshAdsEntitlement(userId?: string | null, opts: { force?: boolean } = {}): Promise<void> {
  const id = userId !== undefined ? userId : current.userId;
  if (!id) return Promise.resolve();
  if (inFlight) return inFlight;
  if (!opts.force && Date.now() - lastFetchAt < REFRESH_MIN_GAP_MS) return Promise.resolve();
  inFlight = (async () => {
    try {
      const { adFree } = await getMyAdsEntitlement();
      lastFetchAt = Date.now();
      // The account may have changed while the request was in flight; never
      // apply account A's answer to account B.
      if (current.userId === id) set({ userId: id, adFree });
      await AsyncStorage.setItem(ENTITLEMENT_KEY, JSON.stringify({ userId: id, adFree }));
    } catch {
      // Offline or a bad response: keep what we have (fail-open).
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Drops the in-memory copy (sign-out). Storage itself is wiped by wipeUserData. */
export function clearAdsEntitlement(): void {
  lastFetchAt = 0;
  set({ userId: null, adFree: false });
}
