import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import roman from "./roman.js";
import hindi from "./hindi.js";
import urdu from "./urdu.js";

export const LANGS = { roman, hindi, urdu };
const STORAGE_KEY = "fs_lang";
const I18nContext = createContext(null);

function initial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGS[saved] ? saved : "roman";
  } catch {
    return "roman";
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initial);
  const dict = LANGS[lang];

  useEffect(() => {
    document.documentElement.lang = dict.code;
    document.documentElement.dir = dict.dir;
  }, [dict]);

  const setLang = useCallback((l) => {
    if (!LANGS[l]) return;
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: dict, dir: dict.dir, contentLang: dict.contentLang }), [lang, setLang, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const { t, lang, contentLang } = useI18n()` — t is the dictionary object: t.nav.home */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
