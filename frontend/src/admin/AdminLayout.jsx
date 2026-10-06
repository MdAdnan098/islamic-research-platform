import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Icon } from "../components/ui/icons.jsx";
import { BrandName, LogoMark } from "../components/brand/Logo.jsx";
import { ThemeSwitcher } from "../components/public/Controls.jsx";

const NAV = [
  ["/admin", "Dashboard", "grid", true],
  ["/admin/articles", "Articles", "doc"],
  ["/admin/categories", "Categories", "folder"],
  ["/admin/topics", "Topics", "tag"],
  ["/admin/references", "References", "book"],
];

export function AdminShell({ children }) {
  return <div dir="ltr" lang="en" className="admin-root min-h-screen bg-ad-bg font-ui text-ad-ink">{children}</div>;
}

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const link = ({ isActive }) => `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-base font-semibold transition ${isActive ? "bg-ad-brand text-on-accent" : "text-ad-mute hover:bg-ad-bg hover:text-ad-ink"}`;
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5 text-ad-ink">
        <LogoMark size={30} /><div className="leading-tight"><p className="text-sm font-semibold"><BrandName /></p><p className="text-[11px] text-ad-mute">Admin</p></div>
      </div>
      <nav className="flex-1 space-y-1 px-3" onClick={() => setOpen(false)}>
        {NAV.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end} className={link}><Icon name={icon} size={17} />{label}</NavLink>)}
      </nav>
      <div className="space-y-1 border-t border-ad-rule p-3">
        <Link to="/" target="_blank" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ad-mute hover:bg-ad-bg"><Icon name="external" size={16} />View site</Link>
        <ThemeSwitcher up align="start" className="px-1 py-1" />
        <button onClick={async () => { await logout(); nav("/admin/login"); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ad-mute hover:bg-ad-bg"><Icon name="logout" size={16} />Sign out</button>
        <p className="truncate px-3 pt-1 text-xs text-ad-mute/80">{admin?.username}</p>
      </div>
    </div>
  );

  return (
    <AdminShell>
    <div className="lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-e border-ad-rule bg-ad-card lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-ad-rule bg-ad-card px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold"><BrandName /> · Admin</span>
        <div className="flex items-center gap-2"><ThemeSwitcher compact /><button onClick={() => setOpen(true)} aria-label="Menu" className="a-btn !px-2"><Icon name="menu" size={18} /></button></div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="animate-fade absolute inset-y-0 start-0 w-64 bg-ad-card">{sidebar}</aside>
        </div>
      )}
      <main className="min-w-0 p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
    </AdminShell>
  );
}
