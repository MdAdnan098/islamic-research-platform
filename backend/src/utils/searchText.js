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

/* ------------------------------------------------------------------------------------------------ */
/* Sound key (second, looser key) + typo tolerance                                                   */
/* ------------------------------------------------------------------------------------------------ */
/**
 * The consonant skeleton above drops w / v / y completely, so names like "Muaviya" / "Muwaviya" / "movaiya" /
 * "معاویہ" all collapse to a single letter ("m") and nothing can match. The SOUND KEY keeps them when they really
 * are consonants, with the same rules in every script:
 *   w / v / و / व   is a consonant at the start of a word, or between two vowels (mu-a-VI-ya); next to a consonant it is a vowel (khwab).
 *   y / ی / य       is a consonant only at the start of a word (yazeed / یزید); elsewhere it is a vowel (muaviya).
 *   ح / ह           are real h (Urdu and Hindi have no "kh/sh/bh" digraph for them); Hindi final ह is silent (शाह).
 * Everything else works like skeletonOf. It is derived from any text - no word list.
 *   muaviya / muwaviya / movaiya / moavia / معاویہ / मुआविया  -> "mw"
 *   yazeed / یزید / यजीद                                       -> "yjd"
 */
const Y_CHARS = new Set(["y", "\u06CC", "\u092F"]); // y, farsi yeh (the folded yeh), Devanagari ya

export function soundKey(word) {
  const chars = [...word];
  const kinds = chars.map((ch) => {
    if (Y_CHARS.has(ch)) return { t: "Y" };
    const c = AR_MAP[ch] ?? LATIN_MAP[ch];
    if (c === undefined) return { t: "V" };
    if (ch === "\u0939") return { t: "D" };   // Hindi ha
    if (c === "H") return { t: "C", k: "h" }; // Urdu pe-he
    if (c === "h") return { t: "A" };         // Latin h / heh goal: aspirate or silent
    if (c === "w") return { t: "W" };
    return { t: "C", k: c };
  });
  const vowelish = (x) => !!x && (x.t === "V" || x.t === "Y");
  let out = "";
  let afterC = false;
  kinds.forEach((c, i) => {
    const prev = kinds[i - 1], next = kinds[i + 1], last = i === kinds.length - 1;
    if (c.t === "C") { out += c.k; afterC = true; }
    else if (c.t === "D") { if (!last) { out += "h"; afterC = true; } }
    else if (c.t === "A") { if (i === 0 || (!afterC && !last)) { out += "h"; afterC = true; } }
    else if (c.t === "W") { if (i === 0 || (vowelish(prev) && vowelish(next))) { out += "w"; afterC = true; } else afterC = false; }
    else if (c.t === "Y") { if (i === 0 && next) { out += "y"; afterC = true; } else afterC = false; }
    else afterC = false;
  });
  return out.replace(/(.)\1+/g, "$1");
}

/**
 * The two derived key fields of a text (all normalised, space-joined, de-duplicated):
 *   searchKeysTitle  sound keys of the TITLE words (1-letter keys only for words of 3+ letters: "imam", "dua")
 *   searchKeys       sound keys (2+ letters) of every word of the full text
 */
export function buildKeyFields(titleNormalized, fullNormalized) {
  const title = new Set(), body = new Set();
  for (const w of (titleNormalized || "").split(" ")) {
    if (!w) continue;
    const k = soundKey(w);
    if (k.length >= 2 || (k.length === 1 && w.length >= 3)) title.add(k);
  }
  for (const w of (fullNormalized || "").split(" ")) {
    if (!w) continue;
    const k = soundKey(w);
    if (k.length >= 2) body.add(k);
  }
  return { searchKeysTitle: [...title].join(" "), searchKeys: [...body].join(" ").slice(0, MAX_SEARCH_TEXT) };
}

/** All search fields of a short name (folder / category title), built exactly like an article with only a title. */
export function buildNameFields(name) {
  const n = normalizeForSearch(name || "");
  const ph = phoneticWords(n).join(" ");
  return { searchText: n, searchTitle: n, searchPhonetic: ph, searchPhoneticTitle: ph, ...buildKeyFields(n, n) };
}

const ANY = "[^ ]";
/**
 * Regex SOURCE (no flags; works in JS and MongoDB) for "a word that is at most ONE edit away from `word`":
 * a prefix with one wrong letter, or a whole word with one missing / one extra letter.
 */
export function oneEditRegex(word) {
  const c = [...word];
  const esc = (arr) => arr.map(escapeRegex).join("");
  const parts = new Set();
  for (let i = 0; i < c.length; i++) {
    parts.add(`${esc(c.slice(0, i))}${ANY}${esc(c.slice(i + 1))}`);                  // one wrong letter (word may be longer)
    if (c.length > 3) parts.add(`${esc([...c.slice(0, i), ...c.slice(i + 1)])}( |$)`); // one letter missing
  }
  for (let i = 0; i <= c.length; i++) parts.add(`${esc(c.slice(0, i))}${ANY}${esc(c.slice(i))}( |$)`); // one letter extra
  return `(^| )(?:${[...parts].join("|")})`;
}

const MAX_FUZZY_WORD = 24;

/**
 * Every way ONE query word can match: [{ field, re, pts, match }]. `re` is a regex source over a stored field; `pts` its weight
 * in the ranking (exact title > exact text > sounds-alike title > ... > one-letter slips); `match: false` = ranking only.
 * A word matches an article when ANY entry with match !== false matches its field.
 */
export function tokenAlternatives(t) {
  const alts = [
    { field: "searchText", re: escapeRegex(t), pts: 10, match: true },
    { field: "searchTitle", re: escapeRegex(t), pts: 20, match: false },
  ];
  const sk = skeletonOf(t);
  if (sk.length >= MIN_PHONETIC_LEN) {
    alts.push({ field: "searchPhonetic", re: phoneticFieldRegex(sk), pts: 2, match: true });
    alts.push({ field: "searchPhoneticTitle", re: phoneticFieldRegex(sk), pts: 6, match: true });
  }
  const k = soundKey(t);
  if (k.length >= 3) alts.push({ field: "searchKeysTitle", re: `(^| )${escapeRegex(k)}`, pts: 5, match: true });
  else if (k.length === 2 || (k.length === 1 && t.length >= 3)) alts.push({ field: "searchKeysTitle", re: `(^| )${escapeRegex(k)}( |$)`, pts: k.length === 2 ? 5 : 2, match: true });
  if (k.length >= 4) alts.push({ field: "searchKeys", re: `(^| )${escapeRegex(k)}`, pts: 1, match: true });
  if (t.length <= MAX_FUZZY_WORD) {
    if (k.length >= 4 && k.length <= MAX_FUZZY_WORD) {
      alts.push({ field: "searchKeysTitle", re: oneEditRegex(k), pts: 3, match: true });
      alts.push({ field: "searchKeys", re: oneEditRegex(k), pts: 1, match: true });
    }
    if (t.length >= 4) alts.push({ field: "searchTitle", re: oneEditRegex(t), pts: 3, match: true });
  }
  return alts;
}

/**
 * How the query words combine. 1-2 words: every word must match. 3+ words: small words (ka, ki, aur ... = under 4 letters) are neither
 * required nor counted; if two or more words have 4+ letters, ANY TWO of them matching is enough; with one such word that word must
 * match (and if there is none, every word must match).
 */
export function matchPlan(tokens) {
  const alts = tokens.map(tokenAlternatives);
  const ev = tokens.map((t, i) => i).filter((i) => tokens[i].length >= 4);
  if (tokens.length >= 3 && ev.length >= 2) {
    const pairs = [];
    for (let a = 0; a < ev.length; a++) for (let b = a + 1; b < ev.length; b++) pairs.push([ev[a], ev[b]]);
    return { kind: "pairs", alts, pairs };
  }
  if (tokens.length >= 3 && ev.length === 1) return { kind: "all", alts, required: ev };
  return { kind: "all", alts, required: tokens.map((_, i) => i) };
}

/** JS twin of the MongoDB query built from matchPlan (folder names, tests): compiled once per query, then test(fields) per candidate. */
export function makeMatcher(tokens) {
  const plan = matchPlan(tokens);
  const compiled = plan.alts.map((list) => list.filter((a) => a.match !== false).map((a) => ({ field: a.field, re: new RegExp(a.re) })));
  const hit = (i, fields) => compiled[i].some((a) => typeof fields[a.field] === "string" && a.re.test(fields[a.field]));
  return {
    plan,
    test(fields) {
      if (plan.kind === "pairs") return plan.pairs.some(([a, b]) => hit(a, fields) && hit(b, fields));
      return plan.required.every((i) => hit(i, fields));
    },
  };
}

/**
 * Builds the normalised searchable copies of an article.
 * @param {object} article  { title, titleTr, excerpt, seoTitle, seoDescription, blocks }
 * @param {Array<{ book?: string, author?: string, referenceText?: string }>} references  resolved reference documents
 * @returns {{ searchTitle, searchText, searchPhonetic, searchPhoneticTitle, searchKeysTitle, searchKeys: string }}
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
  for (const r of references) parts.push(r?.book, r?.author, r?.referenceText);

  const searchTitle = normalizeForSearch(titles.join(" "));
  const searchText = normalizeForSearch(parts.filter((x) => typeof x === "string").join(" \n ")).slice(0, MAX_SEARCH_TEXT);
  const searchPhoneticTitle = phoneticWords(titles.join(" ")).join(" ");
  const searchPhonetic = phoneticWords(searchText).join(" ").slice(0, MAX_SEARCH_TEXT);
  return { searchTitle, searchText, searchPhonetic, searchPhoneticTitle, ...buildKeyFields(searchTitle, searchText) };
}
