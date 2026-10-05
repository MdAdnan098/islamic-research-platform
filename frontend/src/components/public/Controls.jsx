import { CONTENT_LANGS, useI18n } from "../../i18n/index.jsx";
import { useEffect, useRef, useState } from "react";
import { THEME_MODES, useTheme } from "../../context/ThemeContext.jsx";
import { Icon } from "../ui/icons.jsx";

export function LanguageSwitch({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full border border-rule bg-field p-0.5 text-sm ${className}`}>
      {Object.entries(CONTENT_LANGS).map(([key, d]) => (
        <button
          key={key}
          onClick={() => setLang(key)}
          aria-pressed={lang === key}
          className={`rounded-full px-3 py-1 leading-normal transition-colors ${lang === key ? "bg-accent text-on-accent" : "text-mute hover:text-ink"}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

const THEME_META = {
  auto: { label: "Default", icon: "monitor" },
  light: { label: "Light", icon: "sun" },
  sepia: { label: "Sepia", icon: "sunrise" },
  dark: { label: "Dark", icon: "moon" },
};

/** Theme dropdown: Default · Light · Sepia · Dark (same options as Quran.com). */
export function ThemeSwitcher({ className = "", align = "end", compact = false, up = false }) {
  const { mode, theme, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const current = THEME_META[mode === "auto" ? theme : mode];
  const shown = mode === "auto" ? THEME_META.auto : current;

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); box.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pick = (m) => { setMode(m); setOpen(false); };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${shown.label}`}
        className="inline-flex h-10 items-center gap-2 rounded border border-ink/80 bg-field px-3 text-base font-medium text-ink transition-colors hover:border-accent"
      >
        <Icon name={shown.icon} size={20} />
        <span className={compact ? "hidden sm:inline" : ""}>{shown.label}</span>
        <Icon name="chevUpDown" size={16} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Theme"
          className={`absolute z-50 w-44 animate-fade overflow-hidden rounded-lg border border-rule bg-card p-1 shadow-soft ${up ? "bottom-full mb-2" : "top-full mt-2"} ${align === "end" ? "end-0" : "start-0"}`}
        >
          {THEME_MODES.map((m) => {
            const meta = THEME_META[m];
            const on = mode === m;
            return (
              <li key={m} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-base transition-colors ${on ? "bg-tint font-semibold text-accent" : "text-ink hover:bg-tint"}`}
                >
                  <Icon name={meta.icon} size={19} />
                  <span className="flex-1">{meta.label}</span>
                  {on && <Icon name="check" size={17} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
