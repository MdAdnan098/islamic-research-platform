import { createContext, useContext, useEffect, useMemo, useState } from "react";
import ui from "./roman.js";

/**
 * UI text is ALWAYS the Roman dictionary — it never changes.
 * `lang` is only the *content* language filter (which published
 * articles to show). Persisted in localStorage; `?lang=urdu` in the URL
 * overrides it on load so filtered links can be shared.
 */
export const CONTENT_LANGS = {
  roman: { label: "Roman", code: "en" },
  hindi: { label: "हिन्दी", code: "hi" },
  urdu: { label: "اردو", code: "ur" },
};
const STORAGE_KEY = "fs_lang";
const I18nContext = createContext(null);

function initial() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (CONTENT_LANGS[fromUrl]) return fromUrl;
    const saved = localStorage.getItem(STORAGE_KEY);
    return CONTENT_LANGS[saved] ? saved : "roman";
  } catch {
    return "roman";
  }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => ({ t: ui, lang, setLang, contentLang: CONTENT_LANGS[lang].code }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `{ t, lang, setLang, contentLang }` — t: fixed UI text, contentLang: "en" | "hi" | "ur" for the API. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
