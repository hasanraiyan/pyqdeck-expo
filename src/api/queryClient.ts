import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const DAY = 24 * 60 * 60 * 1000;

export const STALE = {
  catalog: 12 * 60 * 60 * 1000, // semesters, subjects, meta, questions, solutions
  syllabus: 0, // network-first: always revalidate, persisted copy is the offline fallback
  volatile: 5 * 60 * 1000, // similar / repeats
};

// One retention window for everything persisted (the syllabus is the long
// pole; catalog data is refreshed by staleTime long before this). Must be >=
// the persister's maxAge, otherwise restored queries are garbage-collected
// before they can be used offline.
export const PERSIST_MAX_AGE = 30 * DAY;

// Bump to discard every persisted cache after a breaking change to a cached
// payload's shape.
export const CACHE_BUSTER = 'v1';
export const PERSIST_KEY = 'pyq_rq_cache';

// Inactive queries are garbage-collected from JS RAM after 30 minutes to free memory,
// while PERSIST_MAX_AGE keeps them on disk in AsyncStorage for offline availability.
export const IN_MEMORY_GC_TIME = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.catalog,
      gcTime: IN_MEMORY_GC_TIME,
      retry: 1,
      // The API layer already handles origin failover and classifies offline
      // errors; React Query's own online detection is not wired up on RN, so
      // don't let it pause fetches. On failure the previous data stays put.
      networkMode: 'always',
      refetchOnWindowFocus: false,
    },
  },
});

// Only queries that opt in via `meta: { persist: true }` are written to disk.
export const persistMeta = { persist: true } as const;

// Android's AsyncStorage reads a row through a ~2MB CursorWindow, so one
// oversized value would make the whole persisted cache unreadable. Keep it
// under budget by dropping the least recently updated queries first.
const MAX_PERSISTED_BYTES = 1_800_000;

function serialize(client: PersistedClient): string {
  let json = JSON.stringify(client);
  if (json.length <= MAX_PERSISTED_BYTES) return json;

  const queries = [...client.clientState.queries].sort(
    (a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt
  );
  while (queries.length > 0 && json.length > MAX_PERSISTED_BYTES) {
    queries.pop();
    json = JSON.stringify({ ...client, clientState: { ...client.clientState, queries } });
  }
  return json;
}

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
  serialize,
});

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: any) => q.state.status === 'success' && q.meta?.persist === true,
  },
};

/** Settings -> "Clear cache": drop memory and the persisted copy. */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {}
}
