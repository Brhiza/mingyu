import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { safeStorage } from '@/lib/safe-storage';
import { fetchMe, loginAccount, logoutAccount, registerAccount, type AuthUser } from './api';

const TOKEN_KEY = 'ts_auth_token';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const token = safeStorage.get(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe(token)
      .then((u) => {
        if (!active) return;
        if (u) setUser(u);
        else safeStorage.remove(TOKEN_KEY);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const r = await loginAccount(email.trim(), password);
    if (r.token && r.user) {
      safeStorage.set(TOKEN_KEY, r.token);
      setUser(r.user);
      return true;
    }
    if (r.error === 'auth_unavailable') setUnavailable(true);
    setError(r.error ?? 'login_failed');
    return false;
  }, []);

  const register = useCallback(async (email: string, password: string, nickname: string) => {
    setError(null);
    const r = await registerAccount(email.trim(), password, nickname.trim());
    if (r.token && r.user) {
      safeStorage.set(TOKEN_KEY, r.token);
      setUser(r.user);
      return true;
    }
    if (r.error === 'auth_unavailable') setUnavailable(true);
    setError(r.error ?? 'register_failed');
    return false;
  }, []);

  const logout = useCallback(async () => {
    const token = safeStorage.get(TOKEN_KEY);
    if (token) await logoutAccount(token).catch(() => {});
    safeStorage.remove(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, unavailable, login, register, logout }),
    [user, loading, error, unavailable, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
