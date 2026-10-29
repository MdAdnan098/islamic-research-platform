import { useCallback, useEffect, useRef, useState } from "react";
import { addRange, AR_FIELD, arabicSpans, BOLD_FIELD, COLOR_FIELDS, covered, FORMAT_FIELDS, SIZE_FIELDS, SIZE_LADDER, sizeOf, stepSize, TEXT_COLORS, TEXT_COLOR_FIELDS, overlaps, rangesOf, removeRange, syncSpans, trimRange, unitMap } from "../../lib/highlights.js";

/**
 * Admin-only floating toolbar for the current text selection: four highlight colours (yellow, pink, blue, green),
 * "Arabic red" (red text colour, set by hand) and the matching Remove buttons, plus bold / text colours / H1-H3 and
 * the text-size stepper (A- / % / A+) that makes the selected words bigger or smaller for readers too.
 * The selection is mapped to (block id, script version, character offsets) through the data-hl-* attributes
 * the renderer puts on each text element - never by searching for the selected string - so repeated words
 * and sentences are unambiguous. `onApply(edits)` receives [{ blockId, lang, ranges }] (full replacement ranges).
 */
function offsetWithin(el, node, offset) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Selection -> pieces [{ blockId, lang, start, end }] with absolute offsets in each block's version string. */
function readSelection(container) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const pieces = [];
  container.querySelectorAll("[data-hl-block]").forEach((el) => {
    if (!range.intersectsNode(el)) return;
    const text = el.textContent || "";
    const s = el.contains(range.startContainer) ? offsetWithin(el, range.startContainer, range.startOffset) : 0;
    const e = el.contains(range.endContainer) ? offsetWithin(el, range.endContainer, range.endOffset) : text.length;
    const trimmed = trimRange(text, Math.min(s, e), Math.max(s, e));
    if (!trimmed) return;
    const base = Number(el.dataset.hlStart) || 0;
    pieces.push({ blockId: el.dataset.hlBlock, lang: el.dataset.hlLang, start: base + trimmed[0], end: base + trimmed[1] });
  });
  if (!pieces.length) return null;
  return { pieces, rect: range.getBoundingClientRect() };
}

export default function HighlightToolbar({ containerRef, blocks, baseLang, onApply, onTransform }) {
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  /** Spans a selection piece stands for: the same line in every script (when the block is aligned), else just the piece. */
  const spansOf = useCallback((p) => {
    const b = blocksRef.current.find((x) => x.id === p.blockId);
    return (b && syncSpans(b, baseLang, p.lang, [p.start, p.end])) || [{ lang: p.lang, range: [p.start, p.end] }];
  }, [baseLang]);

  const currentRanges = useCallback((blockId, lang, field = "hl") => rangesOf(blocksRef.current.find((b) => b.id === blockId), lang, field), []);

  /** Where "Arabic red" lands for a piece: this version + the same Arabic words (same index) in the other versions. */
  const arabicOf = useCallback((p) => {
    const b = blocksRef.current.find((x) => x.id === p.blockId);
    return b ? arabicSpans(b, baseLang, p.lang, [p.start, p.end]) : { spans: [{ lang: p.lang, range: [p.start, p.end] }], missing: [] };
  }, [baseLang]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // Sticky: a tap elsewhere (which clears the text selection) must NOT hide the bar; it stays until
    // Highlight / Remove is used, the X is pressed, or a new text is selected.
    const update = () => { if (busy) return; const next = readSelection(container); if (next) setSel(next); };
    const onClick = (e) => {
      // Tapping an existing highlight selects it, so "Remove highlight" / "Remove red" appears for it.
      const mark = e.target.closest?.("mark.hl-mark, span.ar-red");
      if (mark && window.getSelection()?.isCollapsed) window.getSelection().selectAllChildren(mark);
    };
    document.addEventListener("selectionchange", update);
    container.addEventListener("click", onClick);
    return () => { document.removeEventListener("selectionchange", update); container.removeEventListener("click", onClick); };
  }, [containerRef, busy]);

  if (!sel) return null;

  // Colours: is any part of the selection already coloured / is all of it already this colour?
  const state = sel.pieces.reduce((acc, p) => {
    const own = spansOf(p).filter((x) => x.lang === p.lang).map((x) => x.range);
    const next = { ...acc, anyMarked: acc.anyMarked, full: { ...acc.full } };
    for (const f of COLOR_FIELDS) {
      const r = currentRanges(p.blockId, p.lang, f);
      if (own.some((x) => overlaps(r, x))) next.anyMarked = true;
      next.full[f] = next.full[f] && own.every((x) => covered(r, x));
    }
    return next;
  }, { anyMarked: false, full: Object.fromEntries(COLOR_FIELDS.map((f) => [f, true])) });
  // Arabic red: is the selection already (partly) red, and which versions do not contain the same Arabic text?
  const ar = sel.pieces.reduce((acc, p) => {
    const a = arabicOf(p);
    const own = a.spans.filter((x) => x.lang === p.lang).map((x) => x.range);
    const r = currentRanges(p.blockId, p.lang, AR_FIELD);
    return { any: acc.any || own.some((x) => overlaps(r, x)), missing: [...new Set([...acc.missing, ...a.missing])] };
  }, { any: false, missing: [] });
  // Some block of the selection has versions whose line count differs: highlight then stays in this script only.
  const unsyncedMap = sel.pieces.map((p) => unitMap(blocksRef.current.find((x) => x.id === p.blockId), baseLang)).find((m) => m?.aligned === false);
  // Bold / text colours: is all of the selection already bold / this colour, and is any formatting present?
  const fmt = sel.pieces.reduce((acc, p) => {
    const next = { any: acc.any, full: { ...acc.full } };
    for (const f of FORMAT_FIELDS) {
      const r = currentRanges(p.blockId, p.lang, f);
      if (overlaps(r, [p.start, p.end])) next.any = true;
      next.full[f] = next.full[f] && covered(r, [p.start, p.end]);
    }
    return next;
  }, { any: false, full: Object.fromEntries(FORMAT_FIELDS.map((f) => [f, true])) });
  // Text size of the selection in percent (100 = normal). `mixed` = the selected words do not all share one size;
  // then the +/- buttons start from the size of the first selected word.
  const sizeAt = (p, range) => {
    const hit = SIZE_FIELDS.find((f) => covered(currentRanges(p.blockId, p.lang, f), range));
    return hit ? sizeOf(hit) : null;
  };
  const sizePieces = sel.pieces.map((p) => {
    const whole = sizeAt(p, [p.start, p.end]);
    if (whole) return whole;
    const anySize = SIZE_FIELDS.some((f) => overlaps(currentRanges(p.blockId, p.lang, f), [p.start, p.end]));
    return anySize ? null : 100; // null = a mix of sizes inside this piece
  });
  const sizeMixed = sizePieces.some((v) => v === null || v !== sizePieces[0]);
  const sizeNow = sizeMixed ? (sizeAt(sel.pieces[0], [sel.pieces[0].start, sel.pieces[0].start + 1]) || 100) : sizePieces[0];
  const NAMES = { en: "Roman", hi: "Hindi", ur: "Urdu" };
  const unsynced = unsyncedMap ? Object.entries(unsyncedMap.counts).map(([l, n]) => `${NAMES[l]} ${n}`).join(", ") : "";
  const arMissing = ar.missing.map((l) => NAMES[l]).join(", ");

  /** mode "add" | "remove" | "size"; field = one of COLOR_FIELDS (a colour), or AR_FIELD, or null for "remove every colour";
   *  for mode "size", field = the wanted size in percent (100 = back to normal). */
  async function run(mode, field) {
    const edits = new Map();
    const put = (blockId, lang, f, change) => {
      const key = `${blockId}|${lang}|${f}`;
      const base = edits.get(key)?.ranges ?? currentRanges(blockId, lang, f);
      edits.set(key, { blockId, lang, field: f, ranges: change(base) });
    };
    for (const p of sel.pieces) {
      // Size: exactly the selected words of the version on screen get this one size (the other sizes step aside).
      if (mode === "size") {
        const range = [p.start, p.end];
        for (const f of SIZE_FIELDS) {
          if (sizeOf(f) === field) put(p.blockId, p.lang, f, (r) => addRange(r, range));
          else if (overlaps(edits.get(`${p.blockId}|${p.lang}|${f}`)?.ranges ?? currentRanges(p.blockId, p.lang, f), range)) put(p.blockId, p.lang, f, (r) => removeRange(r, range));
        }
        continue;
      }
      // Bold / text colour act on exactly the selected words of the version on screen (colours exclude each other).
      if (FORMAT_FIELDS.includes(field) || field === "format-none") {
        const range = [p.start, p.end];
        const targets = field === "format-none" ? FORMAT_FIELDS : [field];
        for (const f of targets) put(p.blockId, p.lang, f, (r) => (mode === "add" ? addRange(r, range) : removeRange(r, range)));
        if (mode === "add" && TEXT_COLOR_FIELDS.includes(field)) for (const o of TEXT_COLOR_FIELDS) if (o !== field) put(p.blockId, p.lang, o, (r) => removeRange(r, range));
        continue;
      }
      if (field === AR_FIELD) {
        for (const { lang, range } of arabicOf(p).spans) put(p.blockId, lang, AR_FIELD, (r) => (mode === "add" ? addRange(r, range) : removeRange(r, range)));
        continue;
      }
      for (const { lang, range } of spansOf(p)) {
        if (mode === "add") {
          put(p.blockId, lang, field, (r) => addRange(r, range));
          // one background colour per character: the other colours step aside
          for (const other of COLOR_FIELDS) if (other !== field && overlaps(edits.get(`${p.blockId}|${lang}|${other}`)?.ranges ?? currentRanges(p.blockId, lang, other), range)) put(p.blockId, lang, other, (r) => removeRange(r, range));
        } else {
          for (const f of COLOR_FIELDS) if (overlaps(edits.get(`${p.blockId}|${lang}|${f}`)?.ranges ?? currentRanges(p.blockId, lang, f), range)) put(p.blockId, lang, f, (r) => removeRange(r, range));
        }
      }
    }
    if (!edits.size) { if (mode !== "size") { window.getSelection()?.removeAllRanges(); setSel(null); } return; }
    setBusy(true); setError("");
    try {
      await onApply([...edits.values()]);
      // Size stays open (offsets do not change), so + / - can be pressed again and again on the same words.
      if (mode !== "size") { window.getSelection()?.removeAllRanges(); setSel(null); }
    } catch (e) { setError(e?.message || "Save nahi hua"); }
    finally { setBusy(false); }
  }

  /** Makes the selected line(s) H1 / H2 / H3, or back to a normal paragraph (level 0). */
  async function heading(level) {
    if (!onTransform) return;
    setBusy(true); setError("");
    try {
      const msg = await onTransform(sel.pieces.map(({ blockId, lang, start, end }) => ({ blockId, lang, start, end })), level);
      if (msg) { setError(msg); return; }
      window.getSelection()?.removeAllRanges();
      setSel(null);
    } catch (e) { setError(e?.message || "Save nahi hua"); }
    finally { setBusy(false); }
  }

  // Fixed under the site header, at the TOP: the phone's own selection menu / "search" sheet appears at the bottom
  // and used to cover a bottom bar. Position never depends on the (possibly stale) selection rectangle.
  const style = { position: "fixed", left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top, 0px) + 72px)" };

  const btn = "rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-50";
  const swatches = [
    { field: "hl", label: "Yellow", style: { background: "#fde047", color: "#b91c1c" } },
    { field: "hlPink", label: "Pink", style: { background: "#FF6EB4", color: "#000" } },
    { field: "hlBlue", label: "Blue", style: { background: "#AEACFF", color: "#000" } },
    { field: "hlGreen", label: "Green", style: { background: "#16a34a", color: "#fff" } },
  ];
  return (
    <div
      role="toolbar"
      aria-label="Highlight"
      dir="ltr"
      style={{ ...style, zIndex: 80 }}
      onMouseDown={(e) => e.preventDefault()}
      className="flex max-w-[94vw] flex-col items-center gap-1 rounded-2xl border border-rule bg-paper p-1.5 text-ink shadow-elev"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {swatches.map((c) => (
          <button key={c.field} type="button" disabled={busy} title={`Highlight ${c.label}`} aria-label={`Highlight ${c.label}`} onClick={() => run("add", c.field)}
            style={c.style} className={`${btn} ${state.full[c.field] ? "ring-2 ring-ink/60" : ""}`}>{busy ? "…" : "Aa"}</button>
        ))}
        <button type="button" disabled={busy} onClick={() => run(ar.any ? "remove" : "add", AR_FIELD)} title={ar.any ? "Arabic ka red hatao" : "Arabic text red karo"}
          className={`${btn} border border-rule bg-card`}><span style={{ color: "#e60000" }}>Arabic</span> {ar.any ? "– Remove red" : "red"}</button>
        {state.anyMarked && <button type="button" disabled={busy} onClick={() => run("remove", null)} className={`${btn} border border-rule bg-card`}>Remove highlight</button>}
        <button type="button" aria-label="Close" onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-tint">✕</button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-rule pt-1.5">
        <button type="button" disabled={busy} title={fmt.full[BOLD_FIELD] ? "Bold hatao" : "Bold"} aria-label="Bold" onClick={() => run(fmt.full[BOLD_FIELD] ? "remove" : "add", BOLD_FIELD)}
          className={`${btn} border border-rule bg-card font-extrabold ${fmt.full[BOLD_FIELD] ? "ring-2 ring-ink/60" : ""}`}>B</button>
        {TEXT_COLORS.map((c) => (
          <button key={c.field} type="button" disabled={busy} title={`Text color ${c.label}`} aria-label={`Text color ${c.label}`} onClick={() => run(fmt.full[c.field] ? "remove" : "add", c.field)}
            className={`${btn} border border-rule bg-card font-bold ${fmt.full[c.field] ? "ring-2 ring-ink/60" : ""}`} style={{ color: c.swatch }}>A</button>
        ))}
        {onTransform && [1, 2, 3].map((n) => (
          <button key={n} type="button" disabled={busy} title={`Line ko H${n} banao`} aria-label={`H${n}`} onClick={() => heading(n)} className={`${btn} border border-rule bg-card`}>H{n}</button>
        ))}
        {onTransform && <button type="button" disabled={busy} title="Heading hatakar normal paragraph" onClick={() => heading(0)} className={`${btn} border border-rule bg-card`}>¶</button>}
        {fmt.any && <button type="button" disabled={busy} onClick={() => run("remove", "format-none")} className={`${btn} border border-rule bg-card`}>Remove bold/color</button>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-rule pt-1.5">
        <button type="button" disabled={busy || sizeNow <= SIZE_LADDER[0]} title="Text chhota karo" aria-label="Text size ghatao" onClick={() => run("size", stepSize(sizeNow, -1))}
          className={`${btn} border border-rule bg-card font-bold`}>A−</button>
        <span aria-live="polite" title={sizeMixed ? "Alag-alag size hain; pehle shabd ka size dikh raha hai" : "Selected text ka size"} className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums">
          {sizeNow}%{sizeMixed ? " *" : ""}
        </span>
        <button type="button" disabled={busy || sizeNow >= SIZE_LADDER[SIZE_LADDER.length - 1]} title="Text bada karo" aria-label="Text size badhao" onClick={() => run("size", stepSize(sizeNow, 1))}
          className={`${btn} border border-rule bg-card font-bold`}>A+</button>
        {(sizeNow !== 100 || sizeMixed) && <button type="button" disabled={busy} title="Normal size (100%)" onClick={() => run("size", 100)} className={`${btn} border border-rule bg-card`}>100%</button>}
      </div>
      {unsynced && <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">Lines teeno zabaan mein barabar nahi ({unsynced}), isliye highlight sirf isi zabaan mein lagega.</p>}
      {arMissing && !ar.any && <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">{arMissing} version mein ye Arabic text same nahi mila, wahan red nahi lagega.</p>}
      {error && <p role="alert" className="max-w-xs px-2 pb-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
