import { createContext, useContext, useState } from "react";

/**
 * Placeholder auth context for the admin area.
 * No real authentication is implemented yet — this only holds the
 * shape future login/logout logic will plug into.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);

  const value = {
    adminUser,
    isAuthenticated: Boolean(adminUser),
    // TODO: implement real login against POST /api/admin/auth/login
    login: async () => {
      throw new Error("Admin authentication is not implemented yet.");
    },
    logout: () => setAdminUser(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
