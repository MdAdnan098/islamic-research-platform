import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f0f10" : "#faf7f0");
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem("fs_theme", next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
