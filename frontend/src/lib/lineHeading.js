import { uid } from "./blocks.js";
import { MARK_FIELDS, isHighlightable, sliceRanges } from "./highlights.js";

/**
 * Turns the selected LINE(S) of a paragraph into a heading (level 1 / 2 / 3), or a heading back into a paragraph (level 0).
 * The paragraph is split around the line: [text before] [heading] [text after]. Every script version (Roman / Hindi / Urdu)
 * is split at the same line, and the highlight / bold / colour marks of each piece are re-based, so nothing shifts.
 *
 * pieces: [{ blockId, lang, start, end }] - offsets into the version that is on screen (what the toolbar reads).
 * Returns { blocks, error }; `error` is a message when nothing could be changed.
 */
const SYNC = ["en", "hi", "ur"];
const isSacred = (b) => b.type === "quote" && (b.kind === "ayat" || b.kind === "hadith");

function versionsOf(b, baseLang) {
  const v = { [baseLang]: typeof b.text === "string" ? b.text : "" };
  for (const l of SYNC) if (l !== baseLang && typeof b.tr?.[l] === "string" && b.tr[l].trim()) v[l] = b.tr[l];
  return v;
}

/** [{ a, z }] start/end (end excludes the line break) of every line of `str`. */
function linesOf(str) {
  const out = [];
  let a = 0;
  for (const part of str.split("\n")) { out.push({ a, z: a + part.length }); a += part.length + 1; }
  return out;
}

function splitBlock(b, baseLang, lang, lo, hi, level) {
  const versions = versionsOf(b, baseLang);
  const cuts = Object.fromEntries(Object.entries(versions).map(([l, s]) => [l, linesOf(s)]));
  const n = cuts[lang]?.length;
  if (!n || Object.values(cuts).some((c) => c.length !== n)) {
    return { error: "Is paragraph ke versions (Roman / Hindi / Urdu) mein lines barabar nahi hain, isliye line heading nahi ban sakti. Edit button se heading banayein." };
  }
  const base = cuts[baseLang];
  const isBlank = (i) => !versions[baseLang].slice(base[i].a, base[i].z).trim();

  // runs of lines: selected lines (non-blank) become one heading each, the rest stay text
  const runs = [];
  let i = 0;
  while (i < n) {
    if (i >= lo && i <= hi && !isBlank(i)) { runs.push({ from: i, to: i, head: true }); i += 1; continue; }
    const from = i;
    while (i < n && !(i >= lo && i <= hi && !isBlank(i))) i += 1;
    runs.push({ from, to: i - 1, head: false });
  }

  const out = [];
  for (const run of runs) {
    // a text run is trimmed of blank lines at both ends; nothing left (in the base version) = no block
    let { from, to } = run;
    if (!run.head) {
      while (from <= to && isBlank(from)) from += 1;
      while (to >= from && isBlank(to)) to -= 1;
      if (from > to) continue;
    }
    const { type, id, text, tr, kind, source, level: oldLevel, ...rest } = b;
    for (const f of MARK_FIELDS) delete rest[f]; // marks are re-built below, re-based to this piece
    const nb = { ...rest, id: out.length ? uid() : id, type: run.head ? "heading" : "text" };
    if (run.head) nb.level = level;
    const trNew = {};
    for (const [l, str] of Object.entries(versions)) {
      const a = cuts[l][from].a, z = cuts[l][to].z;
      const piece = str.slice(a, z);
      if (l === baseLang) nb.text = piece; else trNew[l] = piece;
      for (const f of MARK_FIELDS) {
        const r = sliceRanges(b[f]?.[l] || [], a, z);
        if (r.length) nb[f] = { ...(nb[f] || {}), [l]: r };
      }
    }
    // keep any other translation keys the block carried (e.g. non-text), replacing only the sliced ones
    const keep = Object.fromEntries(Object.entries(b.tr || {}).filter(([l]) => !(l in versions) || !SYNC.includes(l)));
    const mergedTr = { ...keep, ...trNew };
    if (Object.keys(mergedTr).length) nb.tr = mergedTr;
    out.push(nb);
  }
  return { blocks: out };
}

export function setLineHeading(blocks, baseLang, pieces, level) {
  const byBlock = new Map();
  for (const p of pieces) {
    const cur = byBlock.get(p.blockId);
    byBlock.set(p.blockId, cur ? { ...cur, start: Math.min(cur.start, p.start), end: Math.max(cur.end, p.end) } : { ...p });
  }
  let error = "";
  let changed = false;
  const next = blocks.flatMap((b) => {
    const p = byBlock.get(b.id);
    if (!p || !isHighlightable(b) || isSacred(b) || b.type === "quote") return [b];
    if (b.type === "heading") {
      changed = true;
      if (level > 0) return [{ ...b, level }];
      const { level: _l, ...rest } = b;
      return [{ ...rest, type: "text" }];
    }
    if (level === 0) return [b]; // already a paragraph
    const text = (p.lang === baseLang ? b.text : b.tr?.[p.lang]) || "";
    const lines = linesOf(text);
    const lo = lines.findIndex((l) => p.start < l.z + 1 && p.end > l.a);
    let hi = -1;
    lines.forEach((l, i) => { if (p.start < l.z + 1 && p.end > l.a) hi = i; });
    if (lo < 0 || hi < 0) return [b];
    const res = splitBlock(b, baseLang, p.lang, lo, hi, level);
    if (res.error) { error = res.error; return [b]; }
    changed = true;
    return res.blocks;
  });
  if (!changed) return { blocks, error: error || "Is selection par heading lagane layak koi line nahi mili." };
  return { blocks: next, error: "" };
}
