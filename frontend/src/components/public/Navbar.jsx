import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";
import { Icon } from "../ui/icons.jsx";
import { LanguageSwitch, ThemeToggle } from "./Controls.jsx";

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { to: "/", label: t.nav.home, end: true },
    { to: "/aqaid", label: t.nav.aqaid },
    { to: "/masail", label: t.nav.masail },
  ];
  const linkCls = ({ isActive }) =>
    `relative py-2 text-sm font-medium transition-colors ${isActive ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gold" : "text-mute hover:text-ink"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper">
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <Link to="/" aria-label="Fahm-e-Salaf"><Logo size={40} /></Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => <NavLink key={l.to} {...l} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitch /><ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t.nav.close : t.nav.menu} className="grid h-9 w-9 place-items-center rounded-full border border-rule">
            <Icon name={open ? "x" : "menu"} size={18} />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade border-t border-rule bg-paper md:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} {...l} className={({ isActive }) => `border-b border-rule/60 py-3.5 text-base font-medium ${isActive ? "text-bronze" : ""}`}>{l.label}</NavLink>
            ))}
            <div className="py-4"><LanguageSwitch /></div>
          </nav>
        </div>
      )}
    </header>
  );
}
