import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Theme modes: "auto" follows the device; the rest are fixed. Same set as Quran.com. */
export const THEME_MODES = ["auto", "light", "sepia", "dark"];
const STORAGE_KEY = "fs_theme";
const BAR = { light: "#ffffff", sepia: "#fff7ea", dark: "#202125" };
const ThemeContext = createContext(null);

const systemTheme = () => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const readMode = () => {
  // First visit (nothing saved yet) opens in Light; "auto" only when the reader picks Default.
  try { const s = localStorage.getItem(STORAGE_KEY); return THEME_MODES.includes(s) ? s : "light"; } catch { return "light"; }
};

function apply(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (theme === "sepia") root.setAttribute("data-theme", "sepia"); else root.removeAttribute("data-theme");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "theme-color"); document.head.appendChild(meta); }
  meta.setAttribute("content", BAR[theme]);
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [system, setSystem] = useState(systemTheme);
  const theme = mode === "auto" ? system : mode;

  // Follow the phone/computer theme live (Default mode), incl. older browsers and
  // when the device theme was changed while this tab was in the background.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const on = () => setSystem(systemTheme());
    if (mq.addEventListener) mq.addEventListener("change", on); else mq.addListener?.(on);
    const onShow = () => { if (document.visibilityState !== "hidden") on(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", on);
    window.addEventListener("pageshow", on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", on); else mq.removeListener?.(on);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", on);
      window.removeEventListener("pageshow", on);
    };
  }, []);

  // Safety net for browsers that don't fire the "change" event reliably (some Android
  // browsers): while in Default mode, re-check the device theme every second.
  useEffect(() => {
    if (mode !== "auto") return undefined;
    setSystem(systemTheme());
    const id = setInterval(() => { if (document.visibilityState !== "hidden") setSystem(systemTheme()); }, 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => { apply(theme); }, [theme]);

  const setMode = useCallback((m) => {
    if (!THEME_MODES.includes(m)) return;
    if (m === "auto") setSystem(systemTheme()); // pick up the device theme right now
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
