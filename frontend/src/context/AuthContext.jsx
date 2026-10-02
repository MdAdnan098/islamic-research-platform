import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi } from "../services/admin.js";

const AuthContext = createContext(null);

/** Mounted only around /admin routes, so the public site never calls /me. */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", admin: null });

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi.me(ctrl.signal)
      .then((admin) => setState({ status: "authed", admin }))
      .catch((e) => e?.name !== "AbortError" && setState({ status: "anon", admin: null }));
    const onUnauthorized = () => setState({ status: "anon", admin: null });
    window.addEventListener("fs:unauthorized", onUnauthorized);
    return () => { ctrl.abort(); window.removeEventListener("fs:unauthorized", onUnauthorized); };
  }, []);

  const login = useCallback(async (email, password) => {
    const admin = await adminApi.login(email, password);
    setState({ status: "authed", admin });
  }, []);

  const logout = useCallback(async () => {
    try { await adminApi.logout(); } finally { setState({ status: "anon", admin: null }); }
  }, []);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
