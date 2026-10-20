export const STORAGE_KEY = "fs_font_scale";
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_DEFAULT = 1.0;

export const FONT_SCALE_PRESETS = [
  { scale: 0.85, labelKey: "sizeSmall", defaultLabel: "85%" },
  { scale: 1.0, labelKey: "sizeDefault", defaultLabel: "100%" },
  { scale: 1.15, labelKey: "sizeMedium", defaultLabel: "115%" },
  { scale: 1.3, labelKey: "sizeLarge", defaultLabel: "130%" },
  { scale: 1.45, labelKey: "sizeXLarge", defaultLabel: "145%" },
];

export function clampScale(val) {
  const num = typeof val === "number" ? val : parseFloat(val);
  if (!Number.isFinite(num)) return FONT_SCALE_DEFAULT;
  const rounded = Math.round(num * 100) / 100;
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, rounded));
}

export function readStoredScale() {
  try {
    if (typeof localStorage === "undefined") return FONT_SCALE_DEFAULT;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return FONT_SCALE_DEFAULT;
    const val = parseFloat(raw);
    if (Number.isFinite(val) && val >= FONT_SCALE_MIN && val <= FONT_SCALE_MAX) {
      return Math.round(val * 100) / 100;
    }
  } catch {
    /* ignore */
  }
  return FONT_SCALE_DEFAULT;
}
