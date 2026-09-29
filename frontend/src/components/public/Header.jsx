import { useState } from "react";
import { NavLink } from "react-router-dom";
import Container from "../common/Container.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { MenuIcon, CloseIcon, SearchIcon } from "../common/Icons.jsx";
import { NAV_LINKS } from "../../utils/navigation.js";

function NavItem({ href, label, onClick }) {
  return (
    <NavLink
      to={href}
      end={href === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        `text-sm font-medium transition-colors ${
          isActive ? "text-emerald-700" : "text-slate-600 hover:text-slate-900"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        {/* Logo / site name placeholder */}
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-slate-800 font-serif text-base font-bold text-white">
            IR
          </span>
          <span className="hidden font-serif text-lg font-semibold text-slate-900 sm:block">
            Islamic Research
          </span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} href={link.href} label={link.label} />
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            aria-label="Search"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <SearchIcon />
          </button>
          <LanguageSwitcher />
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </Container>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <Container className="flex flex-col gap-4 py-4">
            <nav className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Language
              </span>
              <LanguageSwitcher />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
