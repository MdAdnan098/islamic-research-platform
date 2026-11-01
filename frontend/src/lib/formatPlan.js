import { addRange, AR_FIELD, arabicSpans, COLOR_FIELDS, FORMAT_FIELDS, overlaps, rangesOf, removeRange, SIZE_FIELDS, sizeOf, TEXT_COLOR_FIELDS, unitMap } from "./highlights.js";
import { buildAlign } from "./blockAlign.js";
import { mapSelection } from "./wordAlign.js";

/**
 * Plans what a formatting action (colour, bold, text colour, text size, Arabic red, remove) changes - as data, without touching anything.
 *
 * THE RULE: the original (source) script is the only formatting source.
 *  - Formatting made on the SOURCE version lands on the selection - a whole block, a line, a few words or ONE word - and on exactly the
 *    same words of the other scripts (lib/wordAlign.js: words are matched by how they sound; whole lines through the stored line mapping).
 *  - Formatting made on a TRANSLATED version changes that version only. Nothing is ever propagated from a translation.
 *  - Nothing is guessed: a version whose words cannot be matched with certainty (different words, reordered sentence, texts that differ too
 *    much) gets no formatting from this action, and a note says which version and why.
 *
 * pieces: [{ blockId, lang, start, end }] (offsets into the version on screen). mode: "add" | "remove" | "size".
 * field: a colour layer, AR_FIELD, bold / text colour layer, "format-none", null (= remove every colour) or - for mode "size" - the wanted percent.
 * Returns { edits, notes }: `edits` go to applyEdits(); entries { blockId, align } store a legacy block's mapping the first time it is used.
 * notes: [{ code, count, langs, blockId }] with code "translated" (made on a translation: this version only), "unmatched" (these versions could not be
 * matched, nothing applied there) or "missed" (matched, but some selected words had no partner there and were left out).
 */
export function planEdits({ blocks, baseLang, pieces, mode, field }) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out = new Map();
  const aligns = new Map();
  const notes = new Map();
  const cache = new Map(); // word matching is computed once per pair of texts, however many pieces are formatted
  const note = (code, id, lang) => {
    if (!notes.has(code)) notes.set(code, { ids: new Set(), langs: new Set(), blockId: id });
    const n = notes.get(code); n.ids.add(id); if (lang) n.langs.add(lang);
  };
  const keyOf = (blockId, lang, f) => `${blockId}|${lang}|${f}`;
  const current = (blockId, lang, f) => out.get(keyOf(blockId, lang, f))?.ranges ?? rangesOf(byId.get(blockId), lang, f);
  const put = (blockId, lang, f, change) => out.set(keyOf(blockId, lang, f), { blockId, lang, field: f, ranges: change(current(blockId, lang, f)) });
  const apply = (blockId, lang, f, range) => put(blockId, lang, f, (r) => (mode === "add" ? addRange(r, range) : removeRange(r, range)));

  for (const p of pieces) {
    const b = byId.get(p.blockId);
    if (!b) continue;
    const sel = [p.start, p.end];
    const fromSource = p.lang === baseLang;
    const map = unitMap(b, baseLang);
    let spans = [{ lang: p.lang, range: sel }]; // what this selection stands for in every script
    if (fromSource) {
      const m = mapSelection(b, baseLang, sel, cache);
      spans = [...spans, ...m.spans];
      if (m.usedUnits && !m.persisted) { const al = buildAlign(b, baseLang); if (al) aligns.set(b.id, al); } // an old block gets its line mapping stored once
      for (const l of m.failed) note("unmatched", b.id, l);
      for (const l of Object.keys(m.missed)) note("missed", b.id, l);
    } else if (map) note("translated", b.id);
    const own = [{ lang: p.lang, range: sel }];
    const exact = spans; // bold / text colour / size / colours: exactly the selected words, in every script it was matched in
    const unit = spans;

    if (mode === "size") {
      for (const sp of exact) {
        for (const f of SIZE_FIELDS) {
          if (sizeOf(f) === field) put(b.id, sp.lang, f, (r) => addRange(r, sp.range));
          else if (overlaps(current(b.id, sp.lang, f), sp.range)) put(b.id, sp.lang, f, (r) => removeRange(r, sp.range));
        }
      }
      continue;
    }
    if (FORMAT_FIELDS.includes(field) || field === "format-none") {
      const targets = field === "format-none" ? FORMAT_FIELDS : [field];
      for (const sp of exact) {
        for (const f of targets) apply(b.id, sp.lang, f, sp.range);
        if (mode === "add" && TEXT_COLOR_FIELDS.includes(field)) for (const o of TEXT_COLOR_FIELDS) if (o !== field) put(b.id, sp.lang, o, (r) => removeRange(r, sp.range));
      }
      continue;
    }
    if (field === AR_FIELD) {
      const spans = fromSource ? arabicSpans(b, baseLang, p.lang, sel).spans : own;
      for (const { lang, range } of spans) apply(b.id, lang, AR_FIELD, range);
      continue;
    }
    for (const { lang, range } of unit) {
      if (mode === "add") {
        put(b.id, lang, field, (r) => addRange(r, range));
        for (const other of COLOR_FIELDS) if (other !== field && overlaps(current(b.id, lang, other), range)) put(b.id, lang, other, (r) => removeRange(r, range)); // one background colour per character
      } else {
        for (const f of COLOR_FIELDS) if (overlaps(current(b.id, lang, f), range)) put(b.id, lang, f, (r) => removeRange(r, range));
      }
    }
  }

  // Only real changes are sent (no-op edits would cost a save for nothing).
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const edits = [...out.values()].filter((e) => !same(e.ranges, rangesOf(byId.get(e.blockId), e.lang, e.field)));
  for (const [blockId, align] of aligns) if (edits.some((e) => e.blockId === blockId)) edits.push({ blockId, align });
  return { edits, notes: [...notes].map(([code, n]) => ({ code, count: n.ids.size, langs: [...n.langs], blockId: n.blockId })) };
}

/**
 * The edits that take `edits` back: every touched layer gets the ranges it has NOW (an empty list removes the layer), a mapping
 * written for the first time is removed again (align: null). Applying them with applyEdits() restores the exact previous state;
 * applying `edits` again is the redo. Valid only while the block texts are unchanged - the toolbar checks that before using it.
 */
export function inverseEdits(blocks, edits) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  return edits.map((e) => {
    const b = byId.get(e.blockId);
    if (e.align) return { blockId: e.blockId, align: b?.align ?? null };
    return { blockId: e.blockId, lang: e.lang, field: e.field, ranges: rangesOf(b, e.lang, e.field || "hl") };
  });
}
