import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi } from "../services/admin.js";
import { setAdminHint } from "../lib/adminHint.js";

const AuthContext = createContext(null);

/** Mounted only around /admin routes, so the public site never calls /me. */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", admin: null });

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi.me(ctrl.signal)
      .then((admin) => { setAdminHint(true); setState({ status: "authed", admin }); })
      .catch((e) => { if (e?.name !== "AbortError") { setAdminHint(false); setState({ status: "anon", admin: null }); } });
    const onUnauthorized = () => { setAdminHint(false); setState({ status: "anon", admin: null }); };
    window.addEventListener("fs:unauthorized", onUnauthorized);
    return () => { ctrl.abort(); window.removeEventListener("fs:unauthorized", onUnauthorized); };
  }, []);

  const login = useCallback(async (username, password) => {
    const admin = await adminApi.login(username, password);
    setAdminHint(true);
    setState({ status: "authed", admin });
  }, []);

  const logout = useCallback(async () => {
    try { await adminApi.logout(); } finally { setAdminHint(false); setState({ status: "anon", admin: null }); }
  }, []);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
