import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Theme modes: "auto" follows the device; the rest are fixed. Same set as Quran.com. */
export const THEME_MODES = ["auto", "light", "sepia", "dark"];
const STORAGE_KEY = "fs_theme";
const BAR = { light: "#ffffff", sepia: "#fff7ea", dark: "#202125" };
const ThemeContext = createContext(null);

const systemTheme = () => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const readMode = () => {
  try { const s = localStorage.getItem(STORAGE_KEY); return THEME_MODES.includes(s) ? s : "auto"; } catch { return "auto"; }
};

function apply(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (theme === "sepia") root.setAttribute("data-theme", "sepia"); else root.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[theme]);
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [system, setSystem] = useState(systemTheme);
  const theme = mode === "auto" ? system : mode;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const on = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  useEffect(() => { apply(theme); }, [theme]);

  const setMode = useCallback((m) => {
    if (!THEME_MODES.includes(m)) return;
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
