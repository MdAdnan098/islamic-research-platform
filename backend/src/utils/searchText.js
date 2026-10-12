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

/* ------------------------------------------------------------------------------------------------ */
/* Phonetic skeleton - lets Roman, Hindi and Urdu spellings of the same word meet                    */
/* ------------------------------------------------------------------------------------------------ */
/**
 * Urdu/Arabic and Hindi are written without short vowels, and Roman spelling varies from writer to writer
 * (ilm / ilme / ilm-e, ghaib / gaib / gayab, rafa / rafu ...). What stays steady is the CONSONANT skeleton:
 * every script is turned into its consonants only, with look-alike sounds folded together
 * (kh/k/q/c -> k, gh/g -> g, z/j/zh -> j, f/ph/p -> p, sh/s/th... -> s/t, w/v only at the start of a word,
 * "h" only when it is a real letter, doubled letters collapsed). It is derived from ANY text: nothing is tied to
 * particular words, titles or folder names.
 *   ilm / ilme / ilm-e / علم / इल्म            -> "lm"
 *   ghaib / gaib / gayab / غیب / ग़ैब            -> "gb"
 *   rafa ul yadain / rafulyadain / رفع الیدین   -> words "rf" "l" "dn"
 */
const AR_MAP = {
  "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s", "ج": "j", "چ": "k", "خ": "k", "د": "d", "ڈ": "d", "ذ": "j",
  "ر": "r", "ڑ": "r", "ز": "j", "ژ": "j", "س": "s", "ش": "s", "ص": "s", "ض": "j", "ط": "t", "ظ": "j", "غ": "g",
  "ف": "p", "ق": "k", "ک": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n", "ں": "n", "ح": "H", "ہ": "h",
  "و": "w", "ؤ": "w",
  // Devanagari consonants (nukta is already stripped by normalizeForSearch)
  "क": "k", "ख": "k", "ग": "g", "घ": "g", "च": "k", "छ": "k", "ज": "j", "झ": "j", "ट": "t", "ठ": "t", "ड": "d", "ढ": "d",
  "ण": "n", "त": "t", "थ": "t", "द": "d", "ध": "d", "न": "n", "प": "p", "फ": "p", "ब": "b", "भ": "b", "म": "m",
  "र": "r", "ल": "l", "ळ": "l", "व": "w", "श": "s", "ष": "s", "स": "s", "ह": "h", "ं": "n", "ँ": "n",
};
const LATIN_MAP = { b: "b", c: "k", d: "d", f: "p", g: "g", h: "h", j: "j", k: "k", l: "l", m: "m", n: "n", p: "p", q: "k", r: "r", s: "s", t: "t", v: "w", w: "w", x: "k", z: "j" };

/** Consonant skeleton of one (already normalised) word. Returns "" for words with no consonants. */
export function skeletonOf(word) {
  const chars = [...word];
  let out = "";
  let afterConsonant = false;
  chars.forEach((ch, i) => {
    const c = AR_MAP[ch] ?? LATIN_MAP[ch];
    if (c === undefined) { afterConsonant = false; return; } // vowel, vowel sign, digit, anything else
    if (c === "H") { out += "h"; afterConsonant = true; return; }           // pe-he is always a real consonant
    if (c === "h") {
      const initial = i === 0, last = i === chars.length - 1;
      if (initial || (!afterConsonant && !last)) { out += "h"; afterConsonant = true; }
      return;                                                                // aspirate (bh, kh ...) or final -ah/-a: not a consonant
    }
    if (c === "w") { if (i === 0) { out += "w"; afterConsonant = true; } else afterConsonant = false; return; } // inside a word w/v/و act as vowels
    out += c;
    afterConsonant = true;
  });
  return out.replace(/(.)\1+/g, "$1");
}

/** Skeletons (length >= 2) of every word in a text, de-duplicated and space-joined - the stored/queried phonetic field. */
export function phoneticWords(text) {
  const seen = new Set();
  for (const w of normalizeForSearch(text || "").split(" ")) {
    const k = skeletonOf(w);
    if (k.length >= 2) seen.add(k);
  }
  return [...seen];
}

/** Query-side: skeletons (length >= 2) of the query words. Particles like "e", "ul", "ud" fall away on their own. */
export const phoneticQueryTokens = (normalizedQuery) => phoneticWords(normalizedQuery).slice(0, MAX_QUERY_TOKENS);

/**
 * Sounds-alike rule shared by article search and folder search. A query word's skeleton `k` matches a word skeleton
 * `w` of the content only when k has at least 3 consonants and w starts with it. Two-consonant skeletons are far too
 * common ("hello" -> "hl" would match "ahl", "hal", "hil" ...), so short words only match as literal text.
 */
export const MIN_PHONETIC_LEN = 3;
export const skeletonMatches = (w, k) => k.length >= MIN_PHONETIC_LEN && w.startsWith(k);

/**
 * Does `name` (a folder / category title) sound like the query? EVERY phonetic query word must match a word of the
 * name, or every word of the name must be found in the query ("wasila ke masail" -> folder "Wasila"). One lucky word
 * is no longer enough.
 */
export function phoneticNameMatch(name, tokens) {
  const keys = (tokens || []).filter((k) => k.length >= MIN_PHONETIC_LEN);
  if (!keys.length) return false;
  const words = phoneticWords(name);
  if (!words.length) return false;
  return keys.every((k) => words.some((w) => skeletonMatches(w, k))) || words.every((w) => keys.some((k) => skeletonMatches(w, k)));
}

/** Mongo regex (on the stored space-joined skeleton field) for one query skeleton; null when it is too short to be fuzzy. */
export const phoneticFieldRegex = (k) => (k.length >= MIN_PHONETIC_LEN ? `(^| )${escapeRegex(k)}` : null);

const MAX_SEARCH_TEXT = 200_000;

/**
 * Builds the normalised searchable copies of an article.
 * @param {object} article  { title, titleTr, excerpt, seoTitle, seoDescription, blocks }
 * @param {Array<{ book?: string, author?: string }>} references  resolved reference documents
 * @returns {{ searchTitle: string, searchText: string, searchPhonetic: string, searchPhoneticTitle: string }}
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
  const searchPhoneticTitle = phoneticWords(titles.join(" ")).join(" ");
  const searchPhonetic = phoneticWords(searchText).join(" ").slice(0, MAX_SEARCH_TEXT);
  return { searchTitle, searchText, searchPhonetic, searchPhoneticTitle };
}
