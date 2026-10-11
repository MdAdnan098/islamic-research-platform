/**
 * Search text helpers (pure, dependency-free).
 *
 * Articles carry a denormalised `searchText` / `searchTitle` (see article.service.js) built with
 * `normalizeForSearch`, and every public query is normalised the same way, so Roman, Hindi and Urdu /
 * Arabic text compare consistently. Normalisation only folds spellings that readers treat as the same
 * letter (Arabic vs Urdu yeh/kaf, hamza forms, harakat, Devanagari nukta ...). It never rewrites the
 * stored article text - only the derived search copy.
 */

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u00AD]/g;
const NON_BREAKING = /[\u00A0\u2007\u202F]/g;
// Arabic harakat, Quranic annotation marks, superscript alef, tatweel
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const LATIN_MARKS = /[\u0300-\u036F]/g;

const FOLD = new Map([
  ["\u064A", "\u06CC"], ["\u0649", "\u06CC"], ["\u06D2", "\u06CC"], ["\u06D3", "\u06CC"], ["\u06CD", "\u06CC"], ["\u06CE", "\u06CC"], // yeh forms -> farsi yeh
  ["\u0643", "\u06A9"],                                                                                                              // arabic kaf -> keheh
  ["\u0647", "\u06C1"], ["\u0629", "\u06C1"], ["\u06C3", "\u06C1"], ["\u06D5", "\u06C1"],                                            // heh forms -> heh goal
  ["\u0623", "\u0627"], ["\u0625", "\u0627"], ["\u0622", "\u0627"], ["\u0671", "\u0627"],                                            // alef forms
  ["\u0624", "\u0648"],                                                                                                              // waw hamza
  ["\u0626", "\u06CC"],                                                                                                              // yeh hamza
  ["\u093C", ""],                                                                                                                    // devanagari nukta
  ["\u0901", "\u0902"],                                                                                                              // chandrabindu -> anusvara
]);
const FOLD_RE = new RegExp(`[${[...FOLD.keys()].join("")}]`, "g");

/** Arabic-Indic and Persian digits -> ASCII digits. */
function foldDigits(s) {
  return s.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
}

export function normalizeForSearch(input) {
  if (typeof input !== "string" || !input) return "";
  let s = input.normalize("NFKC").replace(NON_BREAKING, " ").replace(INVISIBLE, "");
  s = s.normalize("NFD").replace(LATIN_MARKS, "").normalize("NFC"); // strips accents on Latin text only (NFD of Arabic/Devanagari has no U+03xx marks)
  s = s.replace(ARABIC_MARKS, "").replace(FOLD_RE, (c) => FOLD.get(c));
  s = foldDigits(s).toLowerCase();
  // punctuation -> space, but keep letters/digits/marks of every script
  s = s.replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").replace(/\s+/g, " ").trim();
  return s;
}

export const MAX_QUERY_CHARS = 100;
export const MAX_QUERY_TOKENS = 6;
const MIN_QUERY_CHARS = 2;

/**
 * Validates + tokenises a raw public search query.
 * @returns {{ ok: true, tokens: string[], normalized: string } | { ok: false, reason: "empty" | "too_short" | "too_long" }}
 */
export function parseSearchQuery(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_QUERY_CHARS) return { ok: false, reason: "too_long" };
  const normalized = normalizeForSearch(trimmed);
  const tokens = [...new Set(normalized.split(" ").filter(Boolean))].slice(0, MAX_QUERY_TOKENS);
  if (!tokens.length || normalized.replace(/ /g, "").length < MIN_QUERY_CHARS) return { ok: false, reason: "too_short" };
  return { ok: true, tokens, normalized };
}

/** Escapes a literal for use inside a RegExp / MongoDB $regex. Never pass raw user input to a regex without this. */
export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_SEARCH_TEXT = 200_000;

/**
 * Builds the normalised searchable copies of an article.
 * @param {object} article  { title, titleTr, excerpt, seoTitle, seoDescription, blocks }
 * @param {Array<{ book?: string, author?: string }>} references  resolved reference documents
 * @returns {{ searchTitle: string, searchText: string }}
 */
export function buildArticleSearchFields(article, references = []) {
  const titles = [article.title, ...Object.values(article.titleTr || {})].filter((x) => typeof x === "string");
  const parts = [...titles, article.excerpt, article.seoTitle, article.seoDescription];

  for (const b of article.blocks || []) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "heading" || b.type === "text" || b.type === "quote") {
      parts.push(b.text, ...Object.values(b.tr || {}));
      if (b.type === "quote") parts.push(b.source);
    } else if (b.type === "image") parts.push(b.caption, b.alt);
    else if (b.type === "scan") { parts.push(b.caption); (b.pages || []).forEach((p) => parts.push(p?.caption)); }
    else if (b.type === "pdf") parts.push(b.title);
  }
  for (const r of references) parts.push(r?.book, r?.author);

  const searchTitle = normalizeForSearch(titles.join(" "));
  const searchText = normalizeForSearch(parts.filter((x) => typeof x === "string").join(" \n ")).slice(0, MAX_SEARCH_TEXT);
  return { searchTitle, searchText };
}
