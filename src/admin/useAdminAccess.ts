import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { ApiError, adminMe, type AdminMe } from '../api';
import { isAuthEnabled } from '../config/features';
import { registerWipeHook } from '../auth/wipeUserData';
import type { Tools } from './adminLogic';

/**
 * Is the signed-in account an admin, and what may it do? Asked once per signed-in
 * session (the server answers 403 for everyone else). The answer only decides
 * what the app SHOWS; the server re-checks every call. Kept in memory only -
 * nothing admin is written to disk - and dropped on sign-out.
 */

let cached: { userId: string; me: AdminMe | null } | null = null;
registerWipeHook(() => {
  cached = null;
});

export interface AdminAccess {
  loading: boolean;
  isAdmin: boolean;
  tools: Tools;
  name: string;
}

export function useAdminAccess(): AdminAccess {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [state, setState] = useState<{ loading: boolean; me: AdminMe | null }>({
    loading: false,
    me: null,
  });

  useEffect(() => {
    if (!isAuthEnabled || !isLoaded || !isSignedIn || !userId) {
      setState({ loading: false, me: null });
      return;
    }
    if (cached?.userId === userId) {
      setState({ loading: false, me: cached.me });
      return;
    }
    let alive = true;
    setState({ loading: true, me: null });
    adminMe()
      .then((me) => {
        cached = { userId, me };
        if (alive) setState({ loading: false, me });
      })
      .catch((e: ApiError) => {
        // 401/403/404: definitely not an admin (or the server predates this) - remember.
        // A network failure is not an answer, so ask again next time.
        if (e?.status === 401 || e?.status === 403 || e?.status === 404) {
          cached = { userId, me: null };
        }
        if (alive) setState({ loading: false, me: null });
      });
    return () => {
      alive = false;
    };
  }, [isLoaded, isSignedIn, userId]);

  return {
    loading: state.loading,
    isAdmin: !!state.me,
    tools: (state.me?.access.tools ?? {}) as Tools,
    name: state.me?.name ?? '',
  };
}
