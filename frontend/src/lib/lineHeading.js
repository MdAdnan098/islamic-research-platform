import { uid } from "./blocks.js";
import { MARK_FIELDS, isHighlightable, lengthsOf, sliceRanges, splitUnits, unitMap, versionTexts } from "./highlights.js";

/**
 * Turns the selected line(s) / sentence(s) of a paragraph into a heading (level 2 / 3; level 1 still works for old posts), or a
 * heading back into a paragraph (level 0). The paragraph is split around the selection: [text before] [heading] [text after].
 *
 * The same logical unit is cut in every script through the block's stored unit mapping (lib/blockAlign.js) - never by comparing line
 * counts or positions. So the selected sentence (and only that) becomes the heading in Roman, Hindi and Urdu alike, the highlight /
 * bold / colour / size marks of every piece are re-based, and nothing shifts.
 *
 * The original (source) script is the only formatting source: a heading can only be made from the source version on screen.
 * A block with several scripts whose mapping is missing or flagged is never split by guessing: the admin is asked to pair the lines first.
 *
 * pieces: [{ blockId, lang, start, end }] - offsets into the version that is on screen (what the toolbar reads).
 * Returns { blocks, error }; `error` is a message when nothing could be changed (the change is all-or-nothing).
 */
const SYNC = ["en", "hi", "ur"];
const isSacred = (b) => b.type === "quote" && (b.kind === "ayat" || b.kind === "hadith");
const NOT_SOURCE = "Heading sirf original (source) zabaan mein lagti hai. Post ko apni original zabaan mein kholkar H2/H3 lagayein; baaki zabaanon mein wo apne aap lag jayegi.";
const NEEDS_PAIRING = "Is paragraph ki lines Roman / Hindi / Urdu mein pakki tarah match nahi hain, isliye andaze se heading nahi lagayi. Pehle \"Lines match karein\" se lines jodein.";

/** The units of a block in reading order: [{ id, en?: [s, e], hi?: ..., ur?: ... }], or { error }. */
function unitsOf(b, baseLang) {
  const texts = versionTexts(b, baseLang);
  const langs = Object.keys(texts);
  if (langs.length >= 2) {
    const m = unitMap(b, baseLang);
    if (!m?.aligned) return { error: NEEDS_PAIRING };
    return { langs, units: m.versions[baseLang].map((_, i) => Object.fromEntries([["id", m.ids?.[i] || `t${i}`], ...langs.map((l) => [l, m.versions[l][i]])])) };
  }
  const only = langs[0] || baseLang;
  return { langs: [only], units: splitUnits(texts[only] ?? "", "sentence").map((r, i) => ({ id: `t${i}`, [only]: r })) };
}

/** [a, z) of `str` without the whitespace at both ends. */
function trimmed(str, a, z) {
  while (a < z && /\s/.test(str[a])) a++;
  while (z > a && /\s/.test(str[z - 1])) z--;
  return [a, z];
}

function splitBlock(b, baseLang, lo, hi, units, langs, level) {
  const texts = versionTexts(b, baseLang);
  const last = units.length - 1;
  // [from, to) of each piece in every written script: before the selected units, the selected units, after them
  const cut = (l, k) => ({ before: [0, units[lo][l][0]], head: [units[lo][l][0], units[hi][l][1]], after: [units[hi][l][1], texts[l].length] }[k]);
  const kinds = [["before", 0, lo - 1], ["head", lo, hi], ["after", hi + 1, last]];
  const out = [];
  for (const [kind, from, to] of kinds) {
    const range = Object.fromEntries(langs.map((l) => [l, trimmed(texts[l], ...cut(l, kind))]));
    const blank = (l) => range[l][1] <= range[l][0];
    if (blank(baseLang)) {
      if (langs.some((l) => !blank(l))) return { error: NEEDS_PAIRING }; // text with no original counterpart: never dropped silently
      continue;
    }
    const { type: _t, id, text: _x, tr, kind: _k, source: _s, level: _lv, align: _al, ...rest } = b;
    for (const f of MARK_FIELDS) delete rest[f]; // marks are re-built below, re-based to this piece
    const nb = { ...rest, id: out.length ? uid() : id, type: kind === "head" ? "heading" : "text" };
    if (kind === "head") nb.level = level;
    const trNew = {};
    for (const l of langs) {
      if (blank(l)) continue;
      const [a, z] = range[l];
      const piece = texts[l].slice(a, z);
      if (l === baseLang) nb.text = piece; else trNew[l] = piece;
      for (const f of MARK_FIELDS) {
        const r = sliceRanges(b[f]?.[l] || [], a, z);
        if (r.length) nb[f] = { ...(nb[f] || {}), [l]: r };
      }
    }
    const keep = Object.fromEntries(Object.entries(b.tr || {}).filter(([l]) => !SYNC.includes(l)));
    const mergedTr = { ...keep, ...trNew };
    if (Object.keys(mergedTr).length) nb.tr = mergedTr;
    // the mapping of the units that landed in this piece, re-based (ids stay the same)
    if (langs.length > 1 && b.align?.v === 1) {
      const mine = units.slice(from, to + 1).map((u) => Object.fromEntries([["id", u.id], ...langs.filter((l) => u[l] && !blank(l)).map((l) => [l, [u[l][0] - range[l][0], u[l][1] - range[l][0]]])]));
      const { len: _len, ...restAlign } = b.align;
      nb.align = { ...restAlign, units: mine, len: lengthsOf(nb, baseLang) };
    }
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
  if ([...byBlock.values()].some((p) => p.lang !== baseLang)) return { blocks, error: NOT_SOURCE };

  let error = "";
  let changed = false;
  const next = blocks.flatMap((b) => {
    const p = byBlock.get(b.id);
    if (error || !p || !isHighlightable(b) || isSacred(b) || b.type === "quote") return [b];
    if (b.type === "heading") {
      changed = true;
      if (level > 0) return [{ ...b, level }];
      const { level: _l, ...rest } = b;
      return [{ ...rest, type: "text" }];
    }
    if (level === 0) return [b]; // already a paragraph
    const found = unitsOf(b, baseLang);
    if (found.error) { error = found.error; return [b]; }
    const { units, langs } = found;
    const idx = units.map((u, i) => (u[baseLang] && u[baseLang][0] < p.end && u[baseLang][1] > p.start ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return [b];
    const res = splitBlock(b, baseLang, idx[0], idx[idx.length - 1], units, langs, level);
    if (res.error) { error = res.error; return [b]; }
    changed = true;
    return res.blocks;
  });
  if (error) return { blocks, error };
  if (!changed) return { blocks, error: "Is selection par heading lagane layak koi line nahi mili." };
  return { blocks: next, error: "" };
}
