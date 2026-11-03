import { createContext, useContext, useMemo, useState } from "react";
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
// Only written when the visitor changes the language themselves, so everyone else opens in Urdu.
const STORAGE_KEY = "fs_lang_choice";
const DEFAULT_LANG = "urdu";
/** Article language code ("en" | "hi" | "ur") -> content language key. Unknown codes (e.g. "ar") have no key. */
export const LANG_KEY_BY_CODE = { en: "roman", hi: "hindi", ur: "urdu" };
const I18nContext = createContext(null);

function initial() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (CONTENT_LANGS[fromUrl]) return fromUrl;
    const saved = localStorage.getItem(STORAGE_KEY);
    return CONTENT_LANGS[saved] ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function I18nProvider({ children }) {
  const [saved, setLangState] = useState(initial);
  // Language a page opens in on its own (the admin's article opens in the language it was written in).
  // Never saved; any change from the navbar replaces it, and the page clears it when it closes.
  const [pin, setPin] = useState(null);
  const lang = pin || saved;
  const setLang = (next) => {
    setPin(null);
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };
  const pinLang = (key) => setPin(CONTENT_LANGS[key] ? key : null);

  const value = useMemo(() => ({ t: ui, lang, setLang, pinLang, contentLang: CONTENT_LANGS[lang].code }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `{ t, lang, setLang, contentLang }` — t: fixed UI text, contentLang: "en" | "hi" | "ur" for the API. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
