import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { MenuIcon, LogoutIcon } from "../common/Icons.jsx";

export default function AdminTopbar({ onOpenMobileMenu }) {
  const { adminUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open admin menu"
        >
          <MenuIcon />
        </button>
        <h1 className="font-serif text-base font-semibold text-slate-900 sm:text-lg">Dashboard</h1>
      </div>

      <div className="flex items-center gap-3">
        {adminUser?.email && (
          <span className="hidden text-sm text-slate-500 sm:inline">{adminUser.email}</span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
        >
          <LogoutIcon className="h-4 w-4" />
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
