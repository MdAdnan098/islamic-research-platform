import { useEffect, useRef, useState } from "react";
import { SearchGo } from "../ui/SearchGo.jsx";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { SOCIAL } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";
import { Icon } from "../ui/icons.jsx";
import { LanguageDropdown, ThemeSwitcher } from "./Controls.jsx";
import { SOCIALS } from "./Footer.jsx";
import { HERO_SEARCH_PLACEHOLDER } from "../../config/hero.js";

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const header = useRef(null);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const submitSearch = (e) => {
    e.preventDefault();
    const v = q.trim();
    setOpen(false);
    if (v) { nav(`/search?q=${encodeURIComponent(v)}`); setQ(""); } else nav("/search");
  };
  useEffect(() => { setOpen(false); }, [pathname]);

  // Page behind the drawer must not scroll while it is open.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

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
  // Drawer order: Home, Aqaid, Masail, Folders, Latest Posts, Live Sessions, Our Courses, About
  const drawerLinks = [
    ...links,
    { to: "/folders", label: t.home.folders },
    { to: "/latest", label: t.home.latest },
    { to: "/live", label: "Live Sessions" },
    { to: "/courses", label: "Our Courses" },
    { to: "/about", label: t.nav.about },
  ];
  const linkCls = ({ isActive }) =>
    `rounded-full px-4 py-2 text-base font-semibold transition-colors ${isActive ? "bg-tint text-ink" : "text-mute hover:text-ink"}`;
  const itemCls = ({ isActive }) =>
    `flex items-center gap-3 border-b border-rule py-3.5 text-lg font-semibold ${isActive ? "text-accent" : "text-ink"}`;

  return (
    <header ref={header} className="bar-teal sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="container-page flex h-16 items-center justify-between gap-2">
        <Link to="/" aria-label="AthariTV" className="-ms-2 min-w-0"><Logo size={32} badge /></Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => <NavLink key={l.to} {...l} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        <div className="-me-1.5 flex shrink-0 items-center gap-0">
          {/* Search icon hidden for now (restore by un-commenting):
          <Link to="/search" aria-label={t.search.open} title={t.search.title} className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-tint"><Icon name="search" size={21} /></Link> */}
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
        <>
          {/* Dim backdrop; the small gap on the left shows this is a drawer, tapping it closes the menu */}
          <div className="animate-fade fixed inset-0 z-40 bg-black/45" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label={t.nav.menu}
            className="bar-menu drawer-in fixed inset-y-0 right-0 z-50 flex w-[calc(100%-3rem)] max-w-sm flex-col overflow-y-auto bg-paper shadow-elev">
            <div className="flex h-16 shrink-0 items-center justify-end px-3">
              <button type="button" onClick={() => setOpen(false)} aria-label={t.nav.close} className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-tint">
                <Icon name="x" size={22} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col px-5 pb-8" aria-label="Menu">
              <form onSubmit={submitSearch} role="search" className="flex gap-2 border-b border-rule pb-4">
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} dir="auto" placeholder={HERO_SEARCH_PLACEHOLDER} aria-label={HERO_SEARCH_PLACEHOLDER}
                  className="min-w-0 flex-1 rounded-full border border-rule bg-field px-4 py-2 text-base text-[#262626] placeholder:text-[#7a7a7a] focus:border-accent focus:outline-none dark:text-[#dcd7ca] dark:placeholder:text-[#a0a5a3]" />
                <button type="submit" aria-label={t.search.button} className="btn-primary btn-cta grid min-w-[3rem] place-items-center !px-4 !py-2 text-sm"><SearchGo active={q.trim().length > 0} size={18} /></button>
              </form>
              {drawerLinks.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={itemCls}>{l.label}</NavLink>
              ))}

              <div className="flex gap-5 pt-4 text-sm text-mute">
                <Link to="/disclaimer" className="hover:text-ink">{t.nav.disclaimer}</Link>
                <Link to="/privacy" className="hover:text-ink">{t.nav.privacy}</Link>
              </div>

              <div className="flex items-center gap-3 pt-5">
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
            </nav>
          </aside>
        </>
      )}
    </header>
  );
}
