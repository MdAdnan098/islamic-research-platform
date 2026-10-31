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

/**
 * Mark layers. Every layer has the same shape ({ en?: [[s, e], ...], hi?: [...], ur?: [...] }) and its own block field:
 *   hl       yellow background, red text (the original highlight)
 *   hlPink   #FF6EB4 background, black text
 *   hlBlue   #AEACFF background, black text
 *   hlGreen  green background, white text
 *   arRed    red TEXT colour for Arabic (no background) - set by hand, never guessed
 * The four background colours exclude each other on the same characters; arRed is independent of them.
 */
export const COLOR_FIELDS = ["hl", "hlPink", "hlBlue", "hlGreen"];
export const AR_FIELD = "arRed";
/** Text formatting layers (same shape as the colour layers): bold, and one text colour each. They never exclude the background colours. */
export const BOLD_FIELD = "bold";
export const TEXT_COLORS = [
  { field: "tcRed", label: "Red", cls: "tc-red", swatch: "#dc2626" },
  { field: "tcBlue", label: "Blue", cls: "tc-blue", swatch: "#2563eb" },
  { field: "tcGreen", label: "Green", cls: "tc-green", swatch: "#16a34a" },
  { field: "tcGold", label: "Gold", cls: "tc-gold", swatch: "#b45309" },
];
export const TEXT_COLOR_FIELDS = TEXT_COLORS.map((c) => c.field);
export const FORMAT_FIELDS = [BOLD_FIELD, ...TEXT_COLOR_FIELDS];
/**
 * Text size layers: one layer per size step, named "sz<percent>" (sz150 = 150% of the surrounding text). 100% is the
 * normal size and has no layer. Same shape as every other layer, so storage, validation and re-mapping on edit work
 * unchanged. A character has at most one size (setting a new size removes the others on those characters).
 * The percentage is relative to the text around it, so the reader's own font-size control still scales everything.
 */
export const SIZE_STEPS = [50, 60, 70, 80, 90, 110, 125, 150, 175, 200, 250, 300];
export const SIZE_FIELDS = SIZE_STEPS.map((p) => `sz${p}`);
export const sizeOf = (field) => Number(String(field).slice(2));
/** Every size the + / - buttons walk through, normal (100) included. */
export const SIZE_LADDER = [...SIZE_STEPS.filter((p) => p < 100), 100, ...SIZE_STEPS.filter((p) => p > 100)];
/** The next size up (dir = 1) or down (dir = -1) from `current`, clamped to the ends of the ladder. */
export function stepSize(current, dir) {
  let i = SIZE_LADDER.findIndex((p) => p >= current);
  if (i < 0) i = SIZE_LADDER.length - 1;
  if (dir > 0) i = SIZE_LADDER[i] > current ? i : i + 1;
  else i -= 1;
  return SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, Math.max(0, i))];
}
export const MARK_FIELDS = [...COLOR_FIELDS, AR_FIELD, ...FORMAT_FIELDS, ...SIZE_FIELDS];
const COLOR_CLASS = { hl: "hl-mark hl-yellow", hlPink: "hl-mark hl-pink", hlBlue: "hl-mark hl-blue", hlGreen: "hl-mark hl-green" };
export const markClass = (field) => COLOR_CLASS[field] || "hl-mark";

export const rangesOf = (b, lang, field = "hl") => (Array.isArray(b?.[field]?.[lang]) ? b[field][lang] : []);

/** All layers of one block+version that have ranges: [{ field, ranges }]. */
export const layersOf = (b, lang) => MARK_FIELDS.map((field) => ({ field, ranges: rangesOf(b, lang, field) })).filter((l) => l.ranges.length);

/** Layers clipped to [start, end) and made relative to `start` (for rendering one paragraph). */
export const sliceLayers = (layers, start, end) => layers.map((l) => ({ field: l.field, ranges: sliceRanges(l.ranges, start, end) })).filter((l) => l.ranges.length);

/**
 * Cuts `text` into [{ text, field, ar, bold, tc, size }] pieces: `field` = the background colour layer covering the piece
 * (or null), `ar` = true when the piece is in the Arabic-red layer, `size` = its size in percent (null = normal).
 * Colour layers: the first layer in COLOR_FIELDS order wins.
 */
export function segmentsOf(text, layers) {
  const cuts = new Set([0, text.length]);
  const norm = layers.map((l) => ({ field: l.field, ranges: normalizeRanges(l.ranges, text.length) }));
  for (const l of norm) for (const [s, e] of l.ranges) { cuts.add(s); cuts.add(e); }
  const points = [...cuts].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], z = points[i + 1];
    if (z <= a) continue;
    let field = null, ar = false, bold = false, tc = null, size = null;
    for (const l of norm) {
      if (!overlaps(l.ranges, [a, z])) continue;
      if (l.field === AR_FIELD) ar = true;
      else if (l.field === BOLD_FIELD) bold = true;
      else if (TEXT_COLOR_FIELDS.includes(l.field)) { if (!tc) tc = l.field; }
      else if (SIZE_FIELDS.includes(l.field)) { if (!size) size = sizeOf(l.field); }
      else if (!field) field = l.field;
    }
    out.push({ text: text.slice(a, z), field, ar, bold, tc, size });
  }
  return out;
}

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

/**
 * The stored cross-script mapping follows an edit of ONE version's text: the unit ranges of that version are re-mapped exactly
 * like highlight ranges. A unit whose text was deleted in that version, or an edit that reaches across two units, flags the block
 * for manual correction (`review`) instead of guessing. Other versions and all unit ids are untouched.
 */
export function remapAlignLang(block, lang, oldText, newText) {
  const al = block.align;
  if (!al || al.v !== 1 || oldText === newText) return block;
  let review = al.review === true;
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let oEnd = oldText.length, nEnd = newText.length;
  while (oEnd > p && nEnd > p && oldText[oEnd - 1] === newText[nEnd - 1]) { oEnd--; nEnd--; }
  const touched = (al.units || []).filter((u) => u[lang] && u[lang][0] < oEnd && u[lang][1] > p).length;
  if (touched > 1) review = true; // one edit across two units = a merge: ask, do not guess
  const units = (al.units || []).map((u) => {
    if (!u[lang]) return u;
    const [r] = remapRanges(oldText, newText, [u[lang]]);
    const next = { ...u };
    if (r) next[lang] = r; else { delete next[lang]; review = true; }
    return next;
  });
  const len = { ...(al.len || {}) };
  if (String(newText).trim()) len[lang] = newText.length; else delete len[lang];
  const out = { ...al, units, len };
  if (review) out.review = true;
  return { ...block, align: out };
}

/** Block after its text changed: re-maps the marks (every layer) of the version that text belongs to. */
export function withTextEdit(block, baseLang, newText) {
  const next = remapAlignLang({ ...block, text: newText }, baseLang, block.text || "", newText);
  if (!baseLang) return next;
  for (const field of MARK_FIELDS) {
    if (!block[field]) continue;
    const mapped = remapRanges(block.text || "", newText, block[field][baseLang]);
    const layer = { ...block[field] };
    if (mapped.length) layer[baseLang] = mapped; else delete layer[baseLang];
    if (Object.keys(layer).length) next[field] = layer; else delete next[field];
  }
  return next;
}

/** A pasted translation replaces that version's whole text, so marks that referred to the old text are dropped. */
export function withoutVersionMarks(block, lang) {
  const next = { ...block };
  for (const field of MARK_FIELDS) {
    if (!block[field]?.[lang]) continue;
    const layer = { ...block[field] };
    delete layer[lang];
    if (Object.keys(layer).length) next[field] = layer; else delete next[field];
  }
  return next;
}

/**
 * Applies [{ blockId, lang, field?, ranges }] (ranges REPLACE that block+layer+version's ranges; field defaults to "hl") to a
 * blocks array. An entry { blockId, align } stores that block's explicit cross-script mapping (see lib/blockAlign.js).
 */
export function applyEdits(blocks, edits) {
  return blocks.map((b) => {
    const mine = edits.filter((x) => x.blockId === b.id);
    if (!mine.length) return b;
    const next = { ...b };
    for (const { lang, field = "hl", ranges, align } of mine) {
      if (align) { next.align = align; continue; }
      if (!MARK_FIELDS.includes(field)) continue;
      const layer = { ...(next[field] || {}) };
      if (ranges.length) layer[lang] = ranges; else delete layer[lang];
      if (Object.keys(layer).length) next[field] = layer; else delete next[field];
    }
    return next;
  });
}

/**
 * Keeps `align` only when it is well-formed (and only on blocks that can carry one). Range positions are NOT repaired here:
 * a mapping that no longer fits its text is detected when it is read (persistedMap) and flagged, never silently "fixed".
 */
function shapeAlign(b) {
  if (b.align === undefined) return b;
  const { align, ...rest } = b;
  if (!isHighlightable(b) || isSacred(b) || !align || align.v !== 1 || !Array.isArray(align.units) || align.units.length > 500) return rest;
  const units = [];
  for (const u of align.units) {
    if (!u || typeof u.id !== "string" || !u.id || u.id.length > 64) return rest;
    const n = { id: u.id };
    for (const l of SYNC_LANGS) {
      if (u[l] === undefined) continue;
      if (!Array.isArray(u[l]) || u[l].length !== 2 || !Number.isInteger(u[l][0]) || !Number.isInteger(u[l][1]) || u[l][0] < 0 || u[l][1] <= u[l][0]) return rest;
      n[l] = [u[l][0], u[l][1]];
    }
    units.push(n);
  }
  const clean = { v: 1, units };
  if (align.level) clean.level = align.level;
  if (align.review === true) clean.review = true;
  if (align.len && typeof align.len === "object") clean.len = Object.fromEntries(SYNC_LANGS.filter((l) => Number.isInteger(align.len[l])).map((l) => [l, align.len[l]]));
  return { ...rest, align: clean };
}

/**
 * Before saving: drop any mark whose version text no longer exists or that points past its end (for example
 * after the base script of the article changed), so a stale mark can never make the save fail.
 */
export function cleanBlocksHl(blocks, baseLang) {
  return blocks.map((b0) => {
    const b = shapeAlign(b0);
    if (!MARK_FIELDS.some((f) => b[f])) return b;
    const rest = { ...b };
    for (const f of MARK_FIELDS) delete rest[f];
    if (!isHighlightable(b)) return rest;
    for (const field of MARK_FIELDS) {
      if (!b[field]) continue;
      const layer = {};
      for (const [key, ranges] of Object.entries(b[field])) {
        const text = key === baseLang ? b.text : b.tr?.[key];
        if (!text) continue;
        const clean = normalizeRanges(ranges, text.length);
        if (clean.length) layer[key] = clean;
      }
      if (Object.keys(layer).length) rest[field] = layer;
    }
    return rest;
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

/** Is `r` a well-formed [start, end] pair that fits inside a text of `len` characters? */
const PAIR_OK = (r, len) => Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[1] > r[0] && r[1] <= len;

/** { en?: text, hi?: text, ur?: text } - the written (non-blank) versions of a block. */
export function versionTexts(b, baseLang) {
  const texts = {};
  for (const lang of SYNC_LANGS) {
    const s = versionString(b, baseLang, lang);
    if (typeof s === "string" && s.trim()) texts[lang] = s;
  }
  return texts;
}

/** The text length of every written version - stored in `align.len` so a mapping can tell when its text changed behind its back. */
export const lengthsOf = (b, baseLang) => Object.fromEntries(Object.entries(versionTexts(b, baseLang)).map(([l, t]) => [l, t.length]));

/**
 * The count-based PROPOSAL for blocks that have no stored `align` yet (every post written before the permanent mapping
 * existed) and the starting point when a translation is pasted: { aligned, level, versions, counts }.
 * Versions are compared by sentence first; if their sentence counts differ (a converter adds or drops a full stop) by
 * line, then by paragraph - the finest level at which ALL versions have the same count. When none fits, `aligned` is
 * false and `counts` are the line counts (shown to the admin). It never decides anything on its own for new posts:
 * the result is only ever stored as an explicit mapping (see lib/blockAlign.js), and never "fixed up" by guessing.
 */
export function deriveUnitMap(b, baseLang) {
  if (!isHighlightable(b) || isSacred(b) || !baseLang) return null;
  const texts = versionTexts(b, baseLang);
  const langs = Object.keys(texts);
  if (langs.length < 2) return null;
  const at = (level) => Object.fromEntries(langs.map((l) => [l, splitUnits(texts[l], level)]));
  for (const level of LEVELS) {
    const versions = at(level);
    const n = versions[langs[0]].length;
    // a lone line / paragraph would highlight the whole block, which is never what "same line" means - so those levels need 2+
    if (n > (level === "sentence" ? 0 : 1) && langs.every((l) => versions[l].length === n)) {
      return { aligned: true, level, versions, ids: null, persisted: false, counts: Object.fromEntries(langs.map((l) => [l, n])) };
    }
  }
  const lines = at("line");
  return { aligned: false, level: "line", versions: lines, ids: null, persisted: false, counts: Object.fromEntries(langs.map((l) => [l, lines[l].length])) };
}

/**
 * Reads a STORED mapping `block.align = { v: 1, level?, review?, len: { en?, hi?, ur? }, units: [{ id, en?: [s, e], hi?: [s, e], ur?: [s, e] }] }`.
 * Unit N of every version is the same logical unit because they share one `id` - counts, word counts and lengths play no part.
 * A mapping whose ranges no longer fit their text (text changed without the mapping being re-mapped) is `stale`:
 * it is never trusted and never repaired by guessing - the block is flagged for manual correction instead.
 */
function persistedMap(b, texts) {
  const al = b.align;
  const langs = Object.keys(texts);
  const units = Array.isArray(al.units) ? al.units : [];
  let valid = true;
  const seen = new Set();
  for (const u of units) {
    if (!u || typeof u.id !== "string" || !u.id || seen.has(u.id)) { valid = false; break; }
    seen.add(u.id);
    for (const l of SYNC_LANGS) if (u[l] !== undefined && !(texts[l] && PAIR_OK(u[l], texts[l].length))) valid = false;
  }
  if (valid && al.len && typeof al.len === "object") for (const l of langs) if (al.len[l] !== texts[l].length) valid = false;
  if (valid) for (const l of langs) { let prev = 0; for (const u of units) if (u[l]) { if (u[l][0] < prev) valid = false; prev = u[l][1]; } }
  const complete = valid && units.length > 0 && units.every((u) => langs.every((l) => u[l]));
  const versions = Object.fromEntries(langs.map((l) => [l, valid ? units.filter((u) => u[l]).map((u) => u[l]) : []]));
  return {
    aligned: complete && al.review !== true,
    level: al.level || "manual",
    versions,
    ids: units.map((u) => u.id),
    counts: Object.fromEntries(langs.map((l) => [l, versions[l].length])),
    persisted: true,
    stale: !valid,
  };
}

/**
 * { aligned, level, versions: { en?: units, ... }, counts: { en?: n, ... }, ids, persisted } - or null when there is nothing
 * to sync (sacred text, < 2 versions). A block with a stored `align` uses it (stable unit ids, see persistedMap); an old
 * block without one falls back to the count-based proposal of deriveUnitMap (read-only: nothing is written by reading).
 */
export function unitMap(b, baseLang) {
  if (!isHighlightable(b) || isSacred(b) || !baseLang) return null;
  if (b.align && b.align.v === 1) {
    const texts = versionTexts(b, baseLang);
    if (Object.keys(texts).length < 2) return null;
    return persistedMap(b, texts);
  }
  return deriveUnitMap(b, baseLang);
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
  if (!map?.aligned || !map.versions[lang]) return block;
  let next = block;
  // Colour layers follow the line. (arRed is word-level, so it is re-found by its text instead - see arabicSpans.)
  for (const field of COLOR_FIELDS) {
    if (!block[field]) continue;
    // the original (source) script is the only formatting source: a translation never hands its marks to another translation
    const from = [baseLang].find((l) => l !== lang && map.versions[l] && rangesOf(block, l, field).length);
    if (!from) continue;
    const marked = map.versions[from].map((u, i) => (overlaps(rangesOf(block, from, field), u) ? i : -1)).filter((i) => i >= 0);
    if (!marked.length) continue;
    next = { ...next, [field]: { ...(next[field] || {}), [lang]: normalizeRanges(marked.map((i) => map.versions[lang][i])) } };
  }
  if (block[AR_FIELD]) {
    const text = versionString(block, baseLang, lang);
    const from = [baseLang].find((l) => l !== lang && rangesOf(block, l, AR_FIELD).length);
    if (from && text) {
      const src = versionString(block, baseLang, from);
      const found = [];
      for (const r of rangesOf(block, from, AR_FIELD)) {
        const hit = findSame(src, text, r);
        if (hit) found.push(hit);
      }
      if (found.length) next = { ...next, [AR_FIELD]: { ...(next[AR_FIELD] || {}), [lang]: normalizeRanges(found) } };
    }
  }
  return next;
}

/* ------------------------------------------------------------------------------------------------ */
/* Arabic red: the same words in every script                                                       */
/* ------------------------------------------------------------------------------------------------ */
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches `sub` in `text` (whitespace-insensitive: a line break and a space count as the same). Returns all [start, end]. */
function occurrences(text, sub) {
  const parts = sub.split(/\s+/).filter(Boolean).map(escapeRe);
  if (!parts.length) return [];
  const re = new RegExp(parts.join("\\s+"), "g");
  const out = [];
  let m;
  while ((m = re.exec(text))) { out.push([m.index, m.index + m[0].length]); if (m[0].length === 0) re.lastIndex++; }
  return out;
}

/**
 * The Arabic words written in `from` at `range` are the very same characters in every other version, so they are
 * found by index: it is the n-th time this text occurs in `from`, and the n-th time in `to`. null when `to` does not contain it.
 */
function findSame(fromText, toText, [s, e]) {
  const sub = fromText.slice(s, e);
  const n = occurrences(fromText, sub).findIndex(([a]) => a === s);
  if (n < 0) return null;
  return occurrences(toText, sub)[n] || null;
}

/**
 * Where a selection [s, e) of version `lang` should turn red: [{ lang, range }] for this version and, where the
 * same Arabic text exists at the same index, for the other versions. `missing` lists the versions without it.
 * Sacred blocks (ayat / hadith) and single-version blocks stay on their own version.
 */
export function arabicSpans(b, baseLang, lang, [s, e]) {
  const own = [{ lang, range: [s, e] }];
  if (!isHighlightable(b) || isSacred(b) || !baseLang) return { spans: own, missing: [] };
  const fromText = versionString(b, baseLang, lang);
  const spans = [...own], missing = [];
  for (const other of SYNC_LANGS) {
    if (other === lang) continue;
    const t = versionString(b, baseLang, other);
    if (!t.trim()) continue;
    const hit = findSame(fromText, t, [s, e]);
    if (hit) spans.push({ lang: other, range: hit }); else missing.push(other);
  }
  return { spans, missing };
}
