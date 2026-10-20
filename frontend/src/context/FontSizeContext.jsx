import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  STORAGE_KEY,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_PRESETS,
  clampScale,
  readStoredScale,
} from "../lib/fontSize.js";

export {
  STORAGE_KEY,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_PRESETS,
  clampScale,
  readStoredScale,
};

const FontSizeContext = createContext(null);

export function FontSizeProvider({ children }) {
  const [scale, setScaleState] = useState(readStoredScale);

  const setFontScale = useCallback((next) => {
    const clamped = clampScale(next);
    setScaleState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const increaseFontSize = useCallback(() => {
    setScaleState((cur) => {
      const next = clampScale(cur + FONT_SCALE_STEP);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setScaleState((cur) => {
      const next = clampScale(cur - FONT_SCALE_STEP);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetFontSize = useCallback(() => {
    setFontScale(FONT_SCALE_DEFAULT);
  }, [setFontScale]);

  const value = useMemo(
    () => ({
      scale,
      percentage: Math.round(scale * 100),
      isDefault: Math.abs(scale - FONT_SCALE_DEFAULT) < 0.01,
      canIncrease: scale < FONT_SCALE_MAX - 0.01,
      canDecrease: scale > FONT_SCALE_MIN + 0.01,
      setFontScale,
      increaseFontSize,
      decreaseFontSize,
      resetFontSize,
      presets: FONT_SCALE_PRESETS,
    }),
    [scale, setFontScale, increaseFontSize, decreaseFontSize, resetFontSize]
  );

  return <FontSizeContext.Provider value={value}>{children}</FontSizeContext.Provider>;
}

export function useFontSize() {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    return {
      scale: FONT_SCALE_DEFAULT,
      percentage: 100,
      isDefault: true,
      canIncrease: true,
      canDecrease: true,
      setFontScale: () => {},
      increaseFontSize: () => {},
      decreaseFontSize: () => {},
      resetFontSize: () => {},
      presets: FONT_SCALE_PRESETS,
    };
  }
  return ctx;
}
