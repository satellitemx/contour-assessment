'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { meResponseSchema, successResponseSchema } from '@/lib/contracts';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import type { AuthUserContext, PermissionKey } from '@/lib/types';

interface AuthContextValue {
  auth: AuthUserContext | null;
  loading: boolean;
  setAuth: (next: AuthUserContext | null) => void;
  refreshAuth: () => Promise<AuthUserContext | null>;
  logout: () => Promise<void>;
  hasPermission: (key: PermissionKey) => boolean;
  hasAnyPermission: (keys: readonly PermissionKey[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentAuth(): Promise<AuthUserContext | null> {
  try {
    return await apiRequest('/api/auth/me', {
      cache: 'no-store',
      responseSchema: meResponseSchema,
    });
  } catch (err) {
    if (err instanceof ClientApiError && err.status === 401) {
      return null;
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthUserContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const data = await fetchCurrentAuth();
    setAuth(data);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await fetchCurrentAuth();
      if (!active) return;
      setAuth(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        responseSchema: successResponseSchema,
      });
    } finally {
      setAuth(null);
      router.replace('/login');
      router.refresh();
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const perms = auth?.effectivePermissions ?? [];
    return {
      auth,
      loading,
      setAuth,
      refreshAuth,
      logout,
      hasPermission: (key) => hasPermission(perms, key),
      hasAnyPermission: (keys) => hasAnyPermission(perms, keys),
    };
  }, [auth, loading, refreshAuth, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
