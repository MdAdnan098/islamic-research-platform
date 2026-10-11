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
  if (isSacred(b) || want === baseLang || !b.tr?.[want]?.trim()) return baseLang;
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
