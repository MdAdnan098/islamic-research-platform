import { useCallback, useEffect, useRef, useState } from "react";
import { addRange, covered, overlaps, rangesOf, removeRange, trimRange } from "../../lib/highlights.js";

/**
 * Admin-only floating toolbar: Highlight / Remove highlight for the current text selection.
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

export default function HighlightToolbar({ containerRef, blocks, onApply }) {
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const currentRanges = useCallback((blockId, lang) => rangesOf(blocksRef.current.find((b) => b.id === blockId), lang), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // Sticky: a tap elsewhere (which clears the text selection) must NOT hide the bar; it stays until
    // Highlight / Remove is used, the X is pressed, or a new text is selected.
    const update = () => { if (busy) return; const next = readSelection(container); if (next) setSel(next); };
    const onClick = (e) => {
      // Tapping an existing highlight selects it, so "Remove highlight" appears for it.
      const mark = e.target.closest?.("mark.hl-mark");
      if (mark && window.getSelection()?.isCollapsed) window.getSelection().selectAllChildren(mark);
    };
    document.addEventListener("selectionchange", update);
    container.addEventListener("click", onClick);
    return () => { document.removeEventListener("selectionchange", update); container.removeEventListener("click", onClick); };
  }, [containerRef, busy]);

  if (!sel) return null;

  const state = sel.pieces.reduce((acc, p) => {
    const r = currentRanges(p.blockId, p.lang);
    return { anyMarked: acc.anyMarked || overlaps(r, [p.start, p.end]), allMarked: acc.allMarked && covered(r, [p.start, p.end]) };
  }, { anyMarked: false, allMarked: true });

  async function run(mode) {
    const edits = new Map();
    for (const p of sel.pieces) {
      const key = `${p.blockId}|${p.lang}`;
      const base = edits.get(key)?.ranges ?? currentRanges(p.blockId, p.lang);
      edits.set(key, { blockId: p.blockId, lang: p.lang, ranges: mode === "add" ? addRange(base, [p.start, p.end]) : removeRange(base, [p.start, p.end]) });
    }
    setBusy(true); setError("");
    try {
      await onApply([...edits.values()]);
      window.getSelection()?.removeAllRanges();
      setSel(null);
    } catch (e) { setError(e?.message || "Save nahi hua"); }
    finally { setBusy(false); }
  }

  // Fixed under the site header, at the TOP: the phone's own selection menu / "search" sheet appears at the bottom
  // and used to cover a bottom bar. Position never depends on the (possibly stale) selection rectangle.
  const style = { position: "fixed", left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top, 0px) + 72px)" };

  const btn = "rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50";
  return (
    <div
      role="toolbar"
      aria-label="Highlight"
      dir="ltr"
      style={{ ...style, zIndex: 80 }}
      onMouseDown={(e) => e.preventDefault()}
      className="flex max-w-[94vw] flex-col items-center gap-1 rounded-2xl border border-rule bg-paper p-1.5 text-ink shadow-elev"
    >
      <div className="flex items-center gap-1.5">
        {!state.allMarked && <button type="button" disabled={busy} onClick={() => run("add")} className={`${btn} bg-[#fde047] text-[#b91c1c]`}>{busy ? "Saving…" : "Highlight"}</button>}
        {state.anyMarked && <button type="button" disabled={busy} onClick={() => run("remove")} className={`${btn} border border-rule bg-card`}>Remove highlight</button>}
        <button type="button" aria-label="Close" onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-tint">✕</button>
      </div>
      {error && <p role="alert" className="max-w-xs px-2 pb-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
