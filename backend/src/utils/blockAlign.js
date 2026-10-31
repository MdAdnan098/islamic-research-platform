/**
 * Permanent cross-script mapping of a block (backend validation + source-language rules).
 *
 * A text-like block (heading / text / quote) may carry
 *   align: { v: 1, level?: "sentence"|"line"|"para"|"manual", review?: boolean,
 *            len?: { en?, hi?, ur? },
 *            units: [{ id, en?: [start, end], hi?: [...], ur?: [...] }] }
 * Unit N of every script is the same logical unit because they share one `id`. Only ids and integers are stored.
 * (The frontend owns the meaning - see frontend/src/lib/blockAlign.js; the server only checks the shape.)
 */
export const ALIGN_LANGS = ["en", "hi", "ur"];
export const ALIGN_LEVELS = ["sentence", "line", "para", "manual"];
export const MAX_ALIGN_UNITS = 500;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TEXT_TYPES = new Set(["heading", "text", "quote"]);
const MAX_POS = 5_000_000;

const isPos = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_POS;

/** Returns an error message, or null when the block's `align` is absent or well-formed. */
export function validateBlockAlign(block) {
  const a = block?.align;
  if (a === undefined || a === null) return null;
  if (!TEXT_TYPES.has(block.type)) return "only heading, text and quote blocks can carry align.";
  if (block.type === "quote" && (block.kind === "ayat" || block.kind === "hadith")) return "ayat and hadith blocks cannot carry align.";
  if (typeof a !== "object" || Array.isArray(a)) return "align must be an object.";
  if (a.v !== 1) return "align.v must be 1.";
  if (a.review !== undefined && typeof a.review !== "boolean") return "align.review must be true or false.";
  if (a.level !== undefined && !ALIGN_LEVELS.includes(a.level)) return "align.level is not recognised.";
  if (a.len !== undefined) {
    if (typeof a.len !== "object" || a.len === null || Array.isArray(a.len)) return "align.len must be an object.";
    for (const [k, v] of Object.entries(a.len)) if (!ALIGN_LANGS.includes(k) || !isPos(v)) return "align.len has an invalid entry.";
  }
  if (!Array.isArray(a.units) || a.units.length > MAX_ALIGN_UNITS) return `align.units must be an array of at most ${MAX_ALIGN_UNITS} units.`;
  const seen = new Set();
  for (const u of a.units) {
    if (!u || typeof u !== "object" || Array.isArray(u)) return "align.units contains an invalid unit.";
    if (typeof u.id !== "string" || !ID_RE.test(u.id) || seen.has(u.id)) return "align.units needs unique ids (letters, digits, - and _).";
    seen.add(u.id);
    for (const k of Object.keys(u)) {
      if (k === "id") continue;
      if (!ALIGN_LANGS.includes(k)) return `align unit has an unknown key "${k}".`;
      const r = u[k];
      if (!Array.isArray(r) || r.length !== 2 || !isPos(r[0]) || !isPos(r[1]) || r[1] <= r[0]) return `align unit ${k} must be a [start, end] pair.`;
    }
  }
  return null;
}

/** True when any heading / text / quote block holds written text. */
export function hasWrittenText(blocks) {
  return Array.isArray(blocks) && blocks.some((b) => b && TEXT_TYPES.has(b.type) && typeof b.text === "string" && b.text.trim().length > 0);
}

/**
 * The original (source) language of a post is permanent: block text, highlight marks and the cross-script mapping are all keyed to it.
 * Once the post holds any written text, or already has a stored `sourceLanguage`, it can no longer change - a later save that
 * sends a different `language` (for example one re-detected from the text) is ignored. Before any text exists it may still be chosen.
 * An older post without `sourceLanguage` adopts its stored `language` the first time it is saved again.
 *
 * Returns the fields to $set ({} when nothing changes).
 */
export function resolveSourceLanguage(existing, data) {
  const stored = existing.sourceLanguage || existing.language;
  const locked = !!existing.sourceLanguage || hasWrittenText(existing.blocks);
  if (locked) {
    const changes = {};
    if (existing.language !== stored) changes.language = stored;
    if (existing.sourceLanguage !== stored) changes.sourceLanguage = stored;
    return changes;
  }
  const wanted = data.sourceLanguage ?? data.language;
  if (wanted === undefined || wanted === stored && existing.sourceLanguage === wanted) return {};
  return { language: wanted, sourceLanguage: wanted };
}
