import { addRange, AR_FIELD, arabicSpans, COLOR_FIELDS, FORMAT_FIELDS, overlaps, rangesOf, removeRange, SIZE_FIELDS, sizeOf, syncSpans, TEXT_COLOR_FIELDS, unitMap } from "./highlights.js";
import { buildAlign } from "./blockAlign.js";

/**
 * Plans what a formatting action (colour, bold, text colour, text size, Arabic red, remove) changes - as data, without touching anything.
 *
 * THE RULE: the original (source) script is the only formatting source.
 *  - Formatting made on the SOURCE version lands on the selection and, when the selection covers whole mapped unit(s), on the
 *    corresponding unit(s) of the other scripts (found through the stored unit ids, never by word count or position).
 *  - Formatting made on a TRANSLATED version changes that version only. Nothing is ever propagated from a translation.
 *  - A block whose mapping is missing / stale / flagged is never guessed: the formatting stays on the source version and a note says why.
 *
 * pieces: [{ blockId, lang, start, end }] (offsets into the version on screen). mode: "add" | "remove" | "size".
 * field: a colour layer, AR_FIELD, bold / text colour layer, "format-none", null (= remove every colour) or - for mode "size" - the wanted percent.
 * Returns { edits, notes }: `edits` go to applyEdits(); entries { blockId, align } store a legacy block's mapping the first time it is used.
 * notes: [{ code: "translated" | "review" | "partial", count }].
 */
export function planEdits({ blocks, baseLang, pieces, mode, field }) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out = new Map();
  const aligns = new Map();
  const notes = new Map();
  const note = (code, id) => { if (!notes.has(code)) notes.set(code, new Set()); notes.get(code).add(id); };
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
    let whole = null; // [{ lang, range }] - the same whole unit(s) in every script (source selections only)
    if (fromSource) {
      whole = syncSpans(b, baseLang, p.lang, sel);
      if (whole && !map.persisted) { const al = buildAlign(b, baseLang); if (al) aligns.set(b.id, al); }
      else if (!whole && map) note(map.aligned ? "partial" : "review", b.id);
    } else if (map) note("translated", b.id);
    const own = [{ lang: p.lang, range: sel }];
    const exact = whole ? whole.map((x) => (x.lang === p.lang ? { lang: p.lang, range: sel } : x)) : own; // bold / text colour / size: exactly what was selected here
    const unit = whole || own; // background colours: the whole line

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
  return { edits, notes: [...notes].map(([code, ids]) => ({ code, count: ids.size })) };
}
