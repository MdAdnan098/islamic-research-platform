import { CONTENT_LANGS, useI18n } from "../../i18n/index.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { Icon } from "../ui/icons.jsx";

export function LanguageSwitch({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full border border-rule p-0.5 text-sm ${className}`}>
      {Object.entries(CONTENT_LANGS).map(([key, d]) => (
        <button
          key={key}
          onClick={() => setLang(key)}
          aria-pressed={lang === key}
          className={`rounded-full px-3 py-1 leading-normal transition-colors ${lang === key ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button onClick={toggle} aria-label={t.nav.theme} title={t.nav.theme} className={`grid h-9 w-9 place-items-center rounded-full border border-rule text-mute transition-colors hover:border-gold hover:text-ink ${className}`}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}
