/**
 * Highlight marks (backend validation).
 *
 * A text-like block (heading / text / quote) may carry `hl`:
 *     hl: { en?: [[start, end], ...], hi?: [...], ur?: [...] }
 * Each key is the script version the offsets refer to (the same keys as `block.tr`, plus the article's base
 * language for `block.text`). Offsets are UTF-16 code-unit indexes into that exact string (end exclusive).
 * Only numbers are stored - there is never any HTML - so rendering them cannot inject markup.
 */

export const HL_LANGS = ["en", "hi", "ur", "ar"];
/**
 * Mark layers - each has the same `{ lang: [[start, end], ...] }` shape as `hl`:
 *   hl (yellow), hlPink, hlBlue, hlGreen (background colours), arRed (red Arabic text colour),
 *   bold (bold text) and tcRed / tcBlue / tcGreen / tcGold (text colours chosen by the admin).
 */
export const MARK_FIELDS = ["hl", "hlPink", "hlBlue", "hlGreen", "arRed", "bold", "tcRed", "tcBlue", "tcGreen", "tcGold"];
export const MAX_HL_RANGES_PER_VERSION = 500;
const HL_BLOCK_TYPES = new Set(["heading", "text", "quote"]);

export const isHighlightable = (block) => !!block && HL_BLOCK_TYPES.has(block.type);

/** The string a highlight key refers to. `language` is the article's base language. */
export function versionText(block, key, language) {
  if (!block) return "";
  const own = block.tr && typeof block.tr[key] === "string" ? block.tr[key] : null;
  if (language && key === language) return typeof block.text === "string" ? block.text : "";
  if (own !== null && own.trim()) return own;
  // base text is what readers see when a translation is missing
  return typeof block.text === "string" && (!language || key === language) ? block.text : (own ?? "");
}

/**
 * Validates one block's `hl`. Returns an error message or null.
 * `language` may be undefined (partial update without it): the bound is then the longer of the candidate strings.
 */
export function validateBlockHighlights(block, language) {
  for (const field of MARK_FIELDS) {
    const error = validateLayer(block, field, language);
    if (error) return error;
  }
  return null;
}

function validateLayer(block, field, language) {
  const layer = block[field];
  if (layer === undefined || layer === null) return null;
  if (!isHighlightable(block)) return "only heading, text and quote blocks can carry highlights.";
  if (typeof layer !== "object" || Array.isArray(layer)) return `${field} must be an object keyed by language.`;

  for (const [key, ranges] of Object.entries(layer)) {
    if (!HL_LANGS.includes(key)) return `${field} has an unknown language key "${key}".`;
    if (!Array.isArray(ranges)) return `${field}.${key} must be an array of [start, end] pairs.`;
    if (ranges.length > MAX_HL_RANGES_PER_VERSION) return `${field}.${key} has too many ranges (max ${MAX_HL_RANGES_PER_VERSION}).`;

    const candidates = [language ? versionText(block, key, language) : null, block.tr?.[key], block.text].filter((s) => typeof s === "string");
    const bound = language ? (candidates[0] ?? 0).length : Math.max(0, ...candidates.map((s) => s.length));

    let prevEnd = 0;
    for (const r of ranges) {
      if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || !Number.isInteger(r[1])) return `${field}.${key} contains an invalid range.`;
      const [s, e] = r;
      if (s < 0 || e <= s) return `${field}.${key} contains an empty or negative range.`;
      if (s < prevEnd) return `${field}.${key} ranges must be sorted and must not overlap.`;
      if (e > bound) return `${field}.${key} has a range beyond the end of the text.`;
      prevEnd = e;
    }
  }
  return null;
}

/** Sorts, merges touching/overlapping ranges and clamps to [0, length]. Used when the server rewrites ranges it was given. */
export function normalizeRanges(ranges, length = Infinity) {
  const clean = (ranges || [])
    .filter((r) => Array.isArray(r) && Number.isInteger(r[0]) && Number.isInteger(r[1]))
    .map(([s, e]) => [Math.max(0, s), Math.min(length, e)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of clean) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}
