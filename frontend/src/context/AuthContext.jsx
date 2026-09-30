import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

/**
 * Real admin auth state, backed by the Worker's HttpOnly session cookie.
 * On mount it checks GET /api/admin/me once to see if a valid session
 * already exists (e.g. after a page refresh), before anything tries to
 * render protected content.
 */
export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/me");
      setAdminUser(res?.data?.admin || null);
    } catch {
      setAdminUser(null);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/api/admin/login", { email, password });
    setAdminUser(res?.data?.admin || null);
    return res?.data?.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/admin/logout", {});
    } finally {
      setAdminUser(null);
    }
  }, []);

  const value = {
    adminUser,
    isAuthenticated: Boolean(adminUser),
    isCheckingSession,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
