import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar.jsx";
import AdminTopbar from "../components/admin/AdminTopbar.jsx";
import { CloseIcon } from "../components/common/Icons.jsx";

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <NavLink to="/admin/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-slate-800 font-serif text-sm font-bold text-white">
              IR
            </span>
            <span className="font-serif text-sm font-semibold text-slate-900">Admin Panel</span>
          </NavLink>
        </div>
        <AdminSidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <span className="font-serif text-sm font-semibold text-slate-900">Admin Panel</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close admin menu"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
