import { CONTENT_LANGS, useI18n } from "../../i18n/index.jsx";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { Icon } from "../ui/icons.jsx";

/** Closes a dropdown on outside press or Escape (focus returns to its button). */
function useDismiss(open, setOpen, box) {
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); box.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, setOpen, box]);
}

const ICON_BTN = "grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-tint";

export function LanguageSwitch({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full border border-rule bg-field p-0.5 text-sm ${className}`}>
      {Object.entries(CONTENT_LANGS).map(([key, d]) => (
        <button
          key={key}
          onClick={() => setLang(key)}
          aria-pressed={lang === key}
          className={`rounded-full px-3 py-1 leading-normal transition-colors ${lang === key ? "bg-btn text-on-accent" : "text-mute hover:text-ink"}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

/** Compact "LN" dropdown (globe icon): Roman · हिन्दी · اردو — the content-language filter. */
export function LanguageDropdown({ className = "", align = "end" }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useDismiss(open, setOpen, box);

  const pick = (key) => { setLang(key); setOpen(false); };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.nav.language}: ${CONTENT_LANGS[lang].label}`}
        className={ICON_BTN}
      >
        <Icon name="globe" size={22} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t.nav.language}
          className={`absolute top-full z-50 mt-2 w-40 animate-fade overflow-hidden rounded-lg border border-rule bg-card p-1 shadow-soft ${align === "end" ? "end-0" : "start-0"}`}
        >
          {Object.entries(CONTENT_LANGS).map(([key, d]) => {
            const on = lang === key;
            return (
              <li key={key} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => pick(key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-base transition-colors ${on ? "bg-tint font-semibold text-accent" : "text-ink hover:bg-tint"}`}
                >
                  <span className="flex-1">{d.label}</span>
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

/** In-article language picker: sits above the post heading, on the side the heading starts from. */
export function ArticleLanguage({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useDismiss(open, setOpen, box);

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-field px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent/50"
      >
        <span className="text-ink">{t.article.changeLang}</span>
        <span className="cta-text font-semibold">{CONTENT_LANGS[lang].label}</span>
        <Icon name="down" size={14} className="cta-text shrink-0" />
      </button>
      {open && (
        <ul role="listbox" aria-label={t.nav.language} className="absolute start-0 top-full z-40 mt-2 w-44 animate-fade overflow-hidden rounded-lg border border-rule bg-card p-1 shadow-soft">
          {Object.entries(CONTENT_LANGS).map(([key, d]) => {
            const on = lang === key;
            return (
              <li key={key} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => { setLang(key); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-base transition-colors ${on ? "bg-tint font-semibold text-accent" : "text-ink hover:bg-tint"}`}
                >
                  <span className="flex-1">{d.label}</span>
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

/** Theme toggle: one button. Light shows a sun, Dark shows a moon; each tap flips to the other (no dropdown). */
export function ThemeSwitcher({ className = "", showLabel = false }) {
  const { theme, setMode } = useTheme();
  const dark = theme === "dark";
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setMode(dark ? "light" : "dark")}
        aria-label={dark ? "Dark mode on - switch to Light" : "Light mode on - switch to Dark"}
        title={dark ? "Dark" : "Light"}
        className={showLabel ? `${ICON_BTN} !flex !w-auto items-center !rounded-md gap-2.5 px-3 text-sm font-medium` : ICON_BTN}
      >
        <Icon name={dark ? "moon" : "sun"} size={22} />
        {showLabel && <span>{dark ? "Dark" : "Light"}</span>}
      </button>
    </div>
  );
}
