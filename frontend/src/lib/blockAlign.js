import { uid } from "./blocks.js";
import { SYNC_LANGS, deriveUnitMap, lengthsOf, splitUnits, unitMap, versionTexts } from "./highlights.js";

/**
 * Permanent cross-script mapping of ONE block (heading / paragraph / quote).
 *
 * A post keeps one list of blocks and every block already carries all its scripts (`text` + `tr`), so a block id is the same
 * logical block in Roman, Hindi and Urdu. Inside a block, the lines / sentences are tied together by an explicit mapping:
 *
 *   block.align = { v: 1, level?: "sentence" | "line" | "para" | "manual", review?: true,
 *                   len: { en?, hi?, ur? },                       // text length of each version when the mapping was last valid
 *                   units: [{ id, en?: [s, e], hi?: [s, e], ur?: [s, e] }] }
 *
 * Unit N of every script is the same logical unit because they share one `id` - never because of word counts, sentence
 * lengths or position. The mapping follows text edits (remapAlignLang in highlights.js). When it cannot be made with certainty
 * the block is flagged (`review: true`, or detected as stale) and formatting stays in the original script until the admin
 * pairs the lines by hand (pairUnits / the "Lines match karein" editor).
 */
const LEVELS = ["sentence", "line", "para"];
const newUnitId = () => `u${uid().replace(/-/g, "").slice(0, 12)}`;

/** { v, level, units, len, review? } - `review` is set whenever any written version lacks a counterpart for some unit. */
function finish(block, baseLang, units, level, review) {
  const len = lengthsOf(block, baseLang);
  const langs = Object.keys(len);
  const complete = units.length > 0 && units.every((u) => langs.every((l) => u[l]));
  return { v: 1, level, units, len, ...(review || !complete ? { review: true } : {}) };
}

/**
 * A fresh mapping for a block, from the count-based proposal: used when the block has no mapping yet and its versions have
 * exactly the same number of sentences / lines / paragraphs (the converter was told to keep them). If they do not, the result is an
 * EMPTY mapping flagged `review` - nothing is guessed. null when the block has fewer than two written versions.
 */
export function buildAlign(block, baseLang) {
  const d = deriveUnitMap(block, baseLang);
  if (!d) return null;
  if (!d.aligned) return finish(block, baseLang, [], d.level, true);
  const langs = Object.keys(d.versions);
  const n = d.versions[langs[0]].length;
  const units = Array.from({ length: n }, (_, i) => Object.fromEntries([["id", newUnitId()], ...langs.map((l) => [l, d.versions[l][i]])]));
  return finish(block, baseLang, units, d.level, false);
}

/** The block with a stored mapping (an old block gets its proposal stored the first time it is needed). */
export function ensureAlign(block, baseLang) {
  if (block.align?.v === 1) return block;
  const align = buildAlign(block, baseLang);
  return align ? { ...block, align } : block;
}

/**
 * A translation (`lang`) was just pasted into `block.tr[lang]`. Existing unit ids and the other scripts' pairs are kept; the new
 * script is attached to them only when it has exactly as many units as the mapping at the same level - otherwise that script is left
 * unmatched and the block is flagged for manual correction.
 */
export function attachVersion(block, baseLang, lang) {
  const texts = versionTexts(block, baseLang);
  const langs = Object.keys(texts);
  if (langs.length < 2) { const { align: _a, ...rest } = block; return rest; }
  if (!texts[lang]) return block;
  const before = block.align?.v === 1
    ? { ...block, tr: { ...(block.tr || {}), [lang]: "" }, align: { ...block.align, units: (block.align.units || []).map(({ [lang]: _x, ...u }) => u), len: Object.fromEntries(Object.entries(block.align.len || {}).filter(([l]) => l !== lang)) } }
    : null;
  const m = before ? unitMap(before, baseLang) : null;
  const units = before?.align.units || [];
  if (!m || m.stale || !units.length || !units.every((u) => u[baseLang])) {
    const fresh = buildAlign(block, baseLang);
    return fresh ? { ...block, align: fresh } : block;
  }
  for (const level of [before.align.level, ...LEVELS].filter((x, i, a) => LEVELS.includes(x) && a.indexOf(x) === i)) {
    const parts = splitUnits(texts[lang], level);
    if (parts.length === units.length) {
      return { ...block, align: finish(block, baseLang, units.map((u, i) => ({ ...u, [lang]: parts[i] })), before.align.level || level, before.align.review === true) };
    }
  }
  return { ...block, align: finish(block, baseLang, units, before.align.level || "manual", true) };
}

/** "none" (cannot carry a mapping) | "single" (one written version) | "mapped" | "review" (flagged for manual correction). */
export function alignStatus(block, baseLang) {
  const m = unitMap(block, baseLang);
  if (m) return m.aligned ? "mapped" : "review";
  return Object.keys(versionTexts(block, baseLang)).length === 1 ? "single" : "none";
}

/** What the manual editor shows: the units of every written version at `level`, and the current pairing as indexes. */
export function unitChoices(block, baseLang, level) {
  const texts = versionTexts(block, baseLang);
  const parts = Object.fromEntries(Object.entries(texts).map(([l, t]) => [l, splitUnits(t, level).map((range) => ({ range, text: t.slice(range[0], range[1]) }))]));
  const src = parts[baseLang] || [];
  const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const stored = block.align?.v === 1 ? block.align.units || [] : [];
  const initial = {};
  for (const l of Object.keys(texts)) {
    if (l === baseLang) continue;
    initial[l] = src.map((s, i) => {
      const u = stored.find((x) => same(x[baseLang], s.range));
      const j = u?.[l] ? parts[l].findIndex((t) => same(t.range, u[l])) : -1;
      if (j >= 0) return j;
      return !stored.length && parts[l].length === src.length ? i : null;
    });
  }
  return { texts, src, parts, initial };
}

/**
 * Manual pairing from the editor. `pairs[lang][i]` = index (at `level`) of the unit of `lang` that matches unit i of the original
 * script, or null for none. Pairs must keep the reading order. Unit ids of source units that stay unchanged are kept.
 * Returns { align } or { error }.
 */
export function pairUnits(block, baseLang, level, pairs) {
  const { texts, src, parts } = unitChoices(block, baseLang, level);
  if (!texts[baseLang] || !src.length) return { error: "Original text mein koi line/jumla nahi mila." };
  for (const l of Object.keys(texts)) {
    if (l === baseLang) continue;
    let last = -1;
    for (const j of pairs?.[l] || []) {
      if (j === null || j === undefined) continue;
      if (!Number.isInteger(j) || j < 0 || j >= parts[l].length) return { error: "Koi chuni hui line maujood nahi." };
      if (j <= last) return { error: "Lines ki tarteeb same honi chahiye aur ek line do baar nahi chun sakte." };
      last = j;
    }
  }
  const stored = block.align?.v === 1 ? block.align.units || [] : [];
  const units = src.map((s, i) => {
    const kept = stored.find((u) => u[baseLang] && u[baseLang][0] === s.range[0] && u[baseLang][1] === s.range[1]);
    const u = { id: kept?.id || newUnitId(), [baseLang]: s.range };
    for (const l of Object.keys(texts)) {
      if (l === baseLang) continue;
      const j = pairs?.[l]?.[i];
      if (j !== null && j !== undefined) u[l] = parts[l][j].range;
    }
    return u;
  });
  return { align: finish(block, baseLang, units, level, false) };
}
