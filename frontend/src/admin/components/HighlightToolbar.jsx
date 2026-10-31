import { useCallback, useEffect, useRef, useState } from "react";
import { AR_FIELD, arabicSpans, BOLD_FIELD, COLOR_FIELDS, covered, FORMAT_FIELDS, SIZE_FIELDS, sizeOf, TEXT_COLORS, overlaps, rangesOf, syncSpans, trimRange, unitMap } from "../../lib/highlights.js";
import { inverseEdits, planEdits } from "../../lib/formatPlan.js";
import SizeSlider from "./SizeSlider.jsx";
import AlignEditor from "./AlignEditor.jsx";

/**
 * Admin-only floating toolbar for the current text selection: four highlight colours (yellow, pink, blue, green),
 * "Arabic red" (red text colour, set by hand) and the matching Remove buttons, plus bold / text colours, Undo / Redo and
 * the text-size slider (with H3 / H2 / H1 marks) that makes the selected words bigger or smaller for readers too.
 * The original (source) script is the only formatting source: what is formatted on it also lands on the matching lines of the
 * other scripts; formatting made on a translated version stays in that version (see lib/formatPlan.js).
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

const BAR_STYLE = { position: "fixed", left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top, 0px) + 72px)" };

/** Undo / Redo buttons (also used alone, right after an action, when nothing is selected any more). */
function UndoRedo({ counts, busy, onUndo, onRedo }) {
  const b = "grid h-9 w-9 place-items-center rounded-full border border-rule bg-card text-base font-bold disabled:opacity-40";
  return (
    <>
      <button type="button" disabled={busy || !counts[0]} title="Undo (pichla formatting wapas)" aria-label="Undo" onClick={onUndo} className={b}>↶</button>
      <button type="button" disabled={busy || !counts[1]} title="Redo (dobara lagao)" aria-label="Redo" onClick={onRedo} className={b}>↷</button>
    </>
  );
}

function UndoBar({ style, counts, busy, error, onUndo, onRedo, onClose }) {
  return (
    <div role="toolbar" aria-label="Undo Redo" dir="ltr" style={style} onMouseDown={(e) => e.preventDefault()} className="flex max-w-[94vw] flex-col items-center gap-1 rounded-2xl border border-rule bg-paper p-1.5 text-ink shadow-elev">
      <div className="flex items-center gap-1.5">
        <UndoRedo counts={counts} busy={busy} onUndo={onUndo} onRedo={onRedo} />
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-tint">✕</button>
      </div>
      {error && <p role="alert" className="max-w-xs px-2 pb-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function HighlightToolbar({ containerRef, blocks, baseLang, onApply, onAlign }) {
  const [sel, setSel] = useState(null);
  const [alignFor, setAlignFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const undoStack = useRef([]); // one entry per applied action: { undo, redo, texts }
  const redoStack = useRef([]);
  const [counts, setCounts] = useState([0, 0]);
  const [tail, setTail] = useState(false); // after an action the selection is gone: keep a small Undo / Redo bar for a moment
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

  const versionOf = (b, lang) => (lang === baseLang ? b.text : b.tr?.[lang]) || "";
  const syncCounts = () => setCounts([undoStack.current.length, redoStack.current.length]);
  /** What it takes to go back: the ranges (and mapping) as they are NOW, plus the texts they belong to. */
  function snapshot(edits) {
    const cur = blocksRef.current;
    const texts = {};
    for (const e of edits) {
      const b = cur.find((x) => x.id === e.blockId);
      if (b) for (const l of ["en", "hi", "ur"]) texts[`${b.id}|${l}`] = versionOf(b, l);
    }
    const undo = inverseEdits(cur, edits);
    return { undo, redo: edits, texts };
  }
  /** Undo / Redo of ONE formatting action. If the text changed since, the old ranges would be wrong: refuse instead of guessing. */
  async function step(from, to, key) {
    const entry = from.current[from.current.length - 1];
    if (!entry) return;
    const changed = Object.entries(entry.texts).some(([k, t]) => { const [id, l] = k.split("|"); const b = blocksRef.current.find((x) => x.id === id); return !b || versionOf(b, l) !== t; });
    if (changed) { from.current = from.current.slice(0, -1); syncCounts(); setError("Text badal chuka hai, isliye ye undo/redo nahi ho sakta."); return; }
    setBusy(true); setError(""); setInfo("");
    try {
      await onApply(entry[key]);
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, entry];
      syncCounts(); setTail(true);
    } catch (e) { setError(e?.message || "Save nahi hua"); }
    finally { setBusy(false); }
  }

  if (!sel && !alignFor && !(tail && counts[0] + counts[1] > 0)) return null;
  if (!sel && !alignFor) return <UndoBar style={{ ...BAR_STYLE, zIndex: 80 }} counts={counts} busy={busy} error={error} onUndo={() => step(undoStack, redoStack, "undo")} onRedo={() => step(redoStack, undoStack, "redo")} onClose={() => setTail(false)} />;
  if (!sel) return <AlignEditor block={alignFor} baseLang={baseLang} onSave={(align) => onAlign(alignFor.id, align)} onClose={() => setAlignFor(null)} />;

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
  // Original script on screen? Only then does formatting reach the other scripts. A block of the selection whose lines are not
  // matched with certainty (missing / flagged / stale mapping) is never guessed: its formatting stays in this script.
  const fromSource = sel.pieces.every((p) => p.lang === baseLang);
  const blockOf = (p) => blocksRef.current.find((x) => x.id === p.blockId);
  const reviewBlock = fromSource ? sel.pieces.map(blockOf).find((b) => { const m = b && unitMap(b, baseLang); return m && !m.aligned; }) : null;
  const translatedView = !fromSource && sel.pieces.some((p) => { const b = blockOf(p); return b && unitMap(b, baseLang); });
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
  const arMissing = ar.missing.map((l) => NAMES[l]).join(", ");

  const NOTES = {
    translated: `Aap translated version par format kar rahe hain: ye sirf isi zabaan mein lagega. Teeno zabaan mein ek saath lagane ke liye original (${NAMES[baseLang]}) version mein format karein.`,
    review: "Is hisse ki lines teeno zabaan mein pakki tarah match nahi hain, isliye formatting sirf original zabaan mein lagi.",
    partial: "Kuch shabd select kiye hain, isliye formatting sirf isi zabaan mein lagi. Poori line select karein to dusri zabaanon mein bhi lagegi.",
  };

  /** mode "add" | "remove" | "size"; field = one of COLOR_FIELDS (a colour), or AR_FIELD, or null for "remove every colour";
   *  for mode "size", field = the wanted size in percent (100 = back to normal). What lands where is decided by planEdits. */
  async function run(mode, field) {
    const { edits, notes } = planEdits({ blocks: blocksRef.current, baseLang, pieces: sel.pieces, mode, field });
    if (!edits.length) { if (mode !== "size") { window.getSelection()?.removeAllRanges(); setSel(null); } return; }
    setBusy(true); setError(""); setInfo("");
    try {
      const entry = snapshot(edits);
      await onApply(edits);
      undoStack.current = [...undoStack.current, entry].slice(-50);
      redoStack.current = [];
      syncCounts(); setTail(true);
      // Size stays open (offsets do not change), so the slider can be moved again on the same words.
      if (mode !== "size") { window.getSelection()?.removeAllRanges(); setSel(null); }
      else setInfo(notes.map((n) => NOTES[n.code]).filter(Boolean)[0] || "");
    } catch (e) { setError(e?.message || "Save nahi hua"); }
    finally { setBusy(false); }
  }

  // Fixed under the site header, at the TOP: the phone's own selection menu / "search" sheet appears at the bottom
  // and used to cover a bottom bar. Position never depends on the (possibly stale) selection rectangle.
  const style = BAR_STYLE;

  const btn = "rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-50";
  const swatches = [
    { field: "hl", label: "Yellow", style: { background: "#fde047", color: "#000" } },
    { field: "hlPink", label: "Pink", style: { background: "#FF6EB4", color: "#000" } },
    { field: "hlBlue", label: "Blue", style: { background: "#AEACFF", color: "#000" } },
    { field: "hlGreen", label: "Green", style: { background: "#16a34a", color: "#000" } },
  ];
  return (
    <>
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
        <button type="button" aria-label="Close" onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); setTail(false); }} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-tint">✕</button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-rule pt-1.5">
        <button type="button" disabled={busy} title={fmt.full[BOLD_FIELD] ? "Bold hatao" : "Bold"} aria-label="Bold" onClick={() => run(fmt.full[BOLD_FIELD] ? "remove" : "add", BOLD_FIELD)}
          className={`${btn} border border-rule bg-card font-extrabold ${fmt.full[BOLD_FIELD] ? "ring-2 ring-ink/60" : ""}`}>B</button>
        {TEXT_COLORS.map((c) => (
          <button key={c.field} type="button" disabled={busy} title={`Text color ${c.label}`} aria-label={`Text color ${c.label}`} onClick={() => run(fmt.full[c.field] ? "remove" : "add", c.field)}
            className={`${btn} border border-rule bg-card font-bold ${fmt.full[c.field] ? "ring-2 ring-ink/60" : ""}`} style={{ color: c.swatch }}>A</button>
        ))}
        <UndoRedo counts={counts} busy={busy} onUndo={() => step(undoStack, redoStack, "undo")} onRedo={() => step(redoStack, undoStack, "redo")} />
        {fmt.any && <button type="button" disabled={busy} onClick={() => run("remove", "format-none")} className={`${btn} border border-rule bg-card`}>Remove bold/color</button>}
      </div>
      <div className="flex items-center justify-center border-t border-rule pt-1.5">
        <SizeSlider value={sizeNow} mixed={sizeMixed} disabled={busy} onCommit={(v) => run("size", v)} />
      </div>
      {reviewBlock && (
        <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">
          {NOTES.review}{onAlign && <> <button type="button" className="font-semibold text-accent underline" onClick={() => setAlignFor(reviewBlock)}>Lines match karein</button></>}
        </p>
      )}
      {translatedView && <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">{NOTES.translated}</p>}
      {info && !reviewBlock && !translatedView && <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">{info}</p>}
      {arMissing && !ar.any && <p className="max-w-xs px-2 pb-1 text-center text-xs text-mute">{arMissing} version mein ye Arabic text same nahi mila, wahan red nahi lagega.</p>}
      {error && <p role="alert" className="max-w-xs px-2 pb-1 text-center text-xs text-red-600">{error}</p>}
    </div>
    {alignFor && <AlignEditor block={alignFor} baseLang={baseLang} onSave={(align) => onAlign(alignFor.id, align)} onClose={() => setAlignFor(null)} />}
    </>
  );
}
