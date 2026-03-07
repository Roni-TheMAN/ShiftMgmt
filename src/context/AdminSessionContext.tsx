import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ADMIN_SESSION_TIMEOUT_MS } from '../constants/app';

type AdminSessionContextValue = {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  markActivity: () => void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(
  undefined,
);

type AdminSessionProviderProps = PropsWithChildren<{
  onLogout: () => void;
}>;

export function AdminSessionProvider({
  children,
  onLogout,
}: AdminSessionProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    if (!authRef.current) {
      return;
    }
    clearTimer();
    setIsAuthenticated(false);
    onLogout();
  }, [clearTimer, onLogout]);

  const resetInactivityTimer = useCallback(() => {
    if (!authRef.current) {
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      logout();
    }, ADMIN_SESSION_TIMEOUT_MS);
  }, [clearTimer, logout]);

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const markActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (isAuthenticated) {
      resetInactivityTimer();
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [clearTimer, isAuthenticated, resetInactivityTimer]);

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      isAuthenticated,
      login,
      logout,
      markActivity,
    }),
    [isAuthenticated, login, logout, markActivity],
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error('useAdminSession must be used within AdminSessionProvider.');
  }
  return value;
}
