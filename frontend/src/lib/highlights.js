/**
 * Highlight marks - shared by the public renderer, the editor and the admin toolbar.
 *
 * A text-like block (heading / text / quote) may carry `hl: { en?: [[s, e], ...], hi?: [...], ur?: [...] }`.
 * Each key names the script version the offsets refer to; offsets are UTF-16 code-unit indexes into that exact
 * string (end exclusive). Only numbers are stored, never HTML, so rendering them cannot inject markup.
 * (The backend validates the same shape - backend/src/utils/highlights.js.)
 */

const HL_TYPES = new Set(["heading", "text", "quote"]);
export const isHighlightable = (b) => !!b && HL_TYPES.has(b.type);
const isSacred = (b) => b.type === "quote" && (b.kind === "ayat" || b.kind === "hadith");

/** The version key whose text is actually on screen: the reader's language if that translation exists, else the base text. */
export function shownLang(b, baseLang, want) {
  // `tr[want]` is a string for text blocks but an object ({ book, author, ... }) for reference blocks,
  // so it must be checked as a string before .trim() (calling .trim() on that object crashed the page).
  const v = b.tr?.[want];
  if (isSacred(b) || want === baseLang || typeof v !== "string" || !v.trim()) return baseLang;
  return want;
}

export const rangesOf = (b, lang) => (Array.isArray(b?.hl?.[lang]) ? b.hl[lang] : []);

/** Paragraph segments exactly as the renderer splits a text block, each with its start offset in the full string. */
export function splitParagraphs(str) {
  const text = String(str || "");
  const out = [];
  const push = (a, b) => { if (b > a) out.push({ text: text.slice(a, b), start: a }); };
  const re = /\n{2,}/g;
  let last = 0, m;
  while ((m = re.exec(text))) { push(last, m.index); last = m.index + m[0].length; }
  push(last, text.length);
  return out;
}

/** Sorts, merges touching/overlapping ranges, clamps to [0, length]. */
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

export const addRange = (ranges, [s, e]) => normalizeRanges([...ranges, [s, e]]);

/** Removes [s, e) from the ranges (splitting a range when the removed part is in its middle). */
export function removeRange(ranges, [s, e]) {
  const out = [];
  for (const [a, b] of ranges) {
    if (b <= s || a >= e) { out.push([a, b]); continue; }
    if (a < s) out.push([a, s]);
    if (b > e) out.push([e, b]);
  }
  return normalizeRanges(out);
}

export const overlaps = (ranges, [s, e]) => ranges.some(([a, b]) => a < e && b > s);
/** True when [s, e) is entirely covered by existing ranges. */
export const covered = (ranges, [s, e]) => normalizeRanges(ranges).some(([a, b]) => a <= s && b >= e);

/** Ranges clipped to [start, end) and made relative to `start` (for rendering one paragraph). */
export function sliceRanges(ranges, start, end) {
  const out = [];
  for (const [a, b] of ranges) {
    const s = Math.max(a, start), e = Math.min(b, end);
    if (e > s) out.push([s - start, e - start]);
  }
  return out;
}

/** Cuts text into [{ text, marked }] pieces for the given (relative, sorted) ranges. */
export function splitByRanges(text, ranges) {
  const parts = [];
  let at = 0;
  for (const [s, e] of normalizeRanges(ranges, text.length)) {
    if (s > at) parts.push({ text: text.slice(at, s), marked: false });
    parts.push({ text: text.slice(s, e), marked: true });
    at = e;
  }
  if (at < text.length) parts.push({ text: text.slice(at), marked: false });
  return parts;
}

/** Trims whitespace off both ends of [s, e) within `text`; returns null if nothing is left. */
export function trimRange(text, s, e) {
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return e > s ? [s, e] : null;
}

/**
 * Keeps ranges attached to the same words when the text is edited: only the changed middle part of the string
 * is considered (common prefix/suffix are untouched), ranges before it stay, ranges after it shift, ranges
 * that span it grow/shrink, and ranges wholly inside the replaced part disappear.
 */
export function remapRanges(oldText, newText, ranges) {
  if (!ranges?.length || oldText === newText) return ranges || [];
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let oEnd = oldText.length, nEnd = newText.length;
  while (oEnd > p && nEnd > p && oldText[oEnd - 1] === newText[nEnd - 1]) { oEnd--; nEnd--; }
  const delta = nEnd - oEnd;

  const out = [];
  for (const [s, e] of ranges) {
    if (e <= p) out.push([s, e]);
    else if (s >= oEnd) out.push([s + delta, e + delta]);
    else if (s < p && e > oEnd) out.push([s, e + delta]);
    else if (s < p) out.push([s, p]);
    else if (e > oEnd) out.push([nEnd, e + delta]);
    // otherwise the range lay wholly inside the replaced text
  }
  return normalizeRanges(out, newText.length);
}

/** Block after its text changed: re-maps the highlights of the version that text belongs to. */
export function withTextEdit(block, baseLang, newText) {
  if (!block.hl || !baseLang) return { ...block, text: newText };
  const next = { ...block, text: newText };
  const mapped = remapRanges(block.text || "", newText, block.hl[baseLang]);
  const hl = { ...block.hl };
  if (mapped.length) hl[baseLang] = mapped; else delete hl[baseLang];
  if (Object.keys(hl).length) next.hl = hl; else delete next.hl;
  return next;
}

/** A pasted translation replaces that version's whole text, so marks that referred to the old text are dropped. */
export function withoutVersionMarks(block, lang) {
  if (!block.hl?.[lang]) return block;
  const hl = { ...block.hl };
  delete hl[lang];
  const next = { ...block };
  if (Object.keys(hl).length) next.hl = hl; else delete next.hl;
  return next;
}

/** Applies [{ blockId, lang, ranges }] (ranges REPLACE that block+version's ranges) to a blocks array. */
export function applyEdits(blocks, edits) {
  return blocks.map((b) => {
    const mine = edits.filter((x) => x.blockId === b.id);
    if (!mine.length) return b;
    const hl = { ...(b.hl || {}) };
    for (const { lang, ranges } of mine) { if (ranges.length) hl[lang] = ranges; else delete hl[lang]; }
    const next = { ...b };
    if (Object.keys(hl).length) next.hl = hl; else delete next.hl;
    return next;
  });
}

/**
 * Before saving: drop any highlight whose version text no longer exists or that points past its end (for example
 * after the base script of the article changed), so a stale mark can never make the save fail.
 */
export function cleanBlocksHl(blocks, baseLang) {
  return blocks.map((b) => {
    if (!b.hl) return b;
    if (!isHighlightable(b)) { const { hl, ...rest } = b; return rest; }
    const hl = {};
    for (const [key, ranges] of Object.entries(b.hl)) {
      const text = key === baseLang ? b.text : b.tr?.[key];
      if (!text) continue;
      const clean = normalizeRanges(ranges, text.length);
      if (clean.length) hl[key] = clean;
    }
    const { hl: _old, ...rest } = b;
    return Object.keys(hl).length ? { ...rest, hl } : rest;
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Same-line highlights across Roman / Hindi / Urdu                                                  */
/* ------------------------------------------------------------------------------------------------ */
/**
 * A block's text is cut into "units": one sentence (ends with . ! ? । ۔ ؟) or one line (ends at a line break).
 * When every written version of a block has the SAME number of units, unit N of one version is the same line as
 * unit N of the others, so highlighting a unit in one script highlights the same unit in all of them.
 * If the counts differ the block is "not aligned": highlights stay precise and per-script, as before.
 */
export const SYNC_LANGS = ["en", "hi", "ur"];
const UNIT_RE = /[^\n.!?।۔؟]*[.!?।۔؟]+["'”’)»\]]*|[^\n.!?।۔؟]+/g;

/** [[start, end], ...] of every piece of `str`: level "sentence" (default), "line" (one per line break) or "para" (one per blank-line paragraph). */
export function splitUnits(str, level = "sentence") {
  const text = String(str || "");
  const out = [];
  const re = level === "sentence" ? UNIT_RE : level === "line" ? /[^\n]+/g : /[^\n](?:[^\n]|\n(?!\n))*/g;
  for (const m of text.matchAll(re)) {
    const r = trimRange(text, m.index, m.index + m[0].length);
    if (r && /[\p{L}\p{N}]/u.test(text.slice(r[0], r[1]))) out.push(r);
  }
  return out;
}

const versionString = (b, baseLang, lang) => (lang === baseLang ? b.text : b.tr?.[lang]) || "";
const LEVELS = ["sentence", "line", "para"];

/**
 * { aligned, level, versions: { en?: units, ... }, counts: { en?: n, ... } } - or null when there is nothing to sync
 * (sacred text, < 2 versions). Versions are compared by sentence first; if their sentence counts differ (a converter
 * adds or drops a full stop) by line, then by paragraph - the finest level at which ALL versions have the same count.
 * When none fits, `aligned` is false and `counts` are the line counts (shown to the admin).
 */
export function unitMap(b, baseLang) {
  if (!isHighlightable(b) || isSacred(b) || !baseLang) return null;
  const texts = {};
  for (const lang of SYNC_LANGS) {
    const s = versionString(b, baseLang, lang);
    if (typeof s === "string" && s.trim()) texts[lang] = s;
  }
  const langs = Object.keys(texts);
  if (langs.length < 2) return null;
  const at = (level) => Object.fromEntries(langs.map((l) => [l, splitUnits(texts[l], level)]));
  for (const level of LEVELS) {
    const versions = at(level);
    const n = versions[langs[0]].length;
    // a lone line / paragraph would highlight the whole block, which is never what "same line" means - so those levels need 2+
    if (n > (level === "sentence" ? 0 : 1) && langs.every((l) => versions[l].length === n)) {
      return { aligned: true, level, versions, counts: Object.fromEntries(langs.map((l) => [l, n])) };
    }
  }
  const lines = at("line");
  return { aligned: false, level: "line", versions: lines, counts: Object.fromEntries(langs.map((l) => [l, lines[l].length])) };
}

/**
 * The spans [{ lang, range }] that a selection [s, e) of version `lang` stands for in EVERY version - but ONLY when the
 * selection really covers whole sentence(s)/line(s) (a trailing full stop or quote may be left out). A selection of just
 * a few words, or of part of a sentence, returns null: the caller then highlights exactly what was selected, in this
 * script only. (Snapping a partial selection to the whole sentence made one selected line mark the entire item.)
 * Also null when the block is not aligned.
 */
export function syncSpans(b, baseLang, lang, [s, e]) {
  const map = unitMap(b, baseLang);
  if (!map?.aligned || !map.versions[lang]) return null;
  const text = versionString(b, baseLang, lang);
  const idx = [];
  for (let i = 0; i < map.versions[lang].length; i++) {
    const [a, z] = map.versions[lang][i];
    if (!(a < e && z > s)) continue;
    let zz = z; // end of the unit without its closing punctuation
    while (zz > a && /[.!?।۔؟"'”’)»\]\s]/.test(text[zz - 1])) zz--;
    if (s > a || e < Math.max(zz, a + 1)) return null; // partial -> exact selection only
    idx.push(i);
  }
  if (!idx.length) return null;
  return Object.entries(map.versions).flatMap(([l, units]) => idx.map((i) => ({ lang: l, range: units[i] })));
}

/** Block numbers (1-based, same as the [n] markers) whose versions have a different number of lines/sentences. */
export function alignmentIssues(blocks, baseLang) {
  const bad = [];
  blocks.forEach((b, i) => { if (unitMap(b, baseLang)?.aligned === false) bad.push(i + 1); });
  return bad;
}

/** After a translation is pasted: marks of the other versions are carried over to it, line for line (when aligned). */
export function inheritMarks(block, baseLang, lang) {
  const map = unitMap(block, baseLang);
  if (!map?.aligned || !map.versions[lang] || !block.hl) return block;
  const from = [baseLang, ...SYNC_LANGS].find((l) => l !== lang && map.versions[l] && rangesOf(block, l).length);
  if (!from) return block;
  const marked = map.versions[from].map((u, i) => (overlaps(rangesOf(block, from), u) ? i : -1)).filter((i) => i >= 0);
  if (!marked.length) return block;
  return { ...block, hl: { ...block.hl, [lang]: normalizeRanges(marked.map((i) => map.versions[lang][i])) } };
}
