import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { SOCIAL } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";
import { Icon } from "../ui/icons.jsx";
import { LanguageDropdown, ThemeSwitcher } from "./Controls.jsx";
import { SOCIALS } from "./Footer.jsx";

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const header = useRef(null);
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close the menu when tapping outside the header.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!header.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const links = [
    { to: "/", label: t.nav.home, end: true },
    { to: "/aqaid", label: t.nav.aqaid },
    { to: "/masail", label: t.nav.masail },
  ];
  const extra = [
    { to: "/about", label: t.nav.about, icon: "info" },
  ];
  const linkCls = ({ isActive }) =>
    `rounded-full px-4 py-2 text-base font-semibold transition-colors ${isActive ? "bg-tint text-ink" : "text-mute hover:text-ink"}`;
  const itemCls = ({ isActive }) =>
    `flex items-center gap-3 border-b border-rule py-3.5 text-lg font-semibold ${isActive ? "text-accent" : "text-ink"}`;

  return (
    <header ref={header} className="sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="container-page flex h-16 items-center justify-between gap-2">
        <Link to="/" aria-label="Fahm-e-Salaf" className="min-w-0"><Logo size={38} /></Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => <NavLink key={l.to} {...l} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        <div className="-me-1.5 flex shrink-0 items-center gap-1.5">
          <ThemeSwitcher compact />
          <LanguageDropdown />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t.nav.close : t.nav.menu}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-tint"
          >
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade border-t border-rule bg-paper md:absolute md:end-8 md:top-full md:mt-2 md:w-72 md:overflow-hidden md:rounded-xl md:border md:shadow-soft">
          <nav className="flex flex-col px-5 py-2 sm:px-8 md:px-4" aria-label="Menu">
            {links.map((l) => (
              <NavLink key={l.to} {...l} className={(s) => `${itemCls(s)} md:hidden`}>{l.label}</NavLink>
            ))}
            {extra.map((l) => (
              <NavLink key={l.to} to={l.to} className={itemCls}>
                <Icon name={l.icon} size={20} />{l.label}
              </NavLink>
            ))}

            <div className="flex items-center gap-3 py-4">
              {SOCIALS.map(({ key, label, Glyph, bg }) => (
                <a
                  key={key}
                  href={SOCIAL[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  style={{ background: bg }}
                  className="grid h-10 w-10 place-items-center rounded-full shadow-soft transition duration-200 hover:opacity-90"
                >
                  <Glyph />
                </a>
              ))}
            </div>

            <div className="flex gap-5 pb-3 text-sm text-mute">
              <Link to="/disclaimer" className="hover:text-ink">{t.nav.disclaimer}</Link>
              <Link to="/privacy" className="hover:text-ink">{t.nav.privacy}</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
