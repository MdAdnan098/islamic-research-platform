import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/index.jsx";
import { Icon } from "../ui/icons.jsx";

const STEPS = [1, 1.5, 2, 3, 4];

/** Fullscreen zoomable viewer for scans/images. pages: [{ src, caption }] */
export function ScanViewer({ pages, start = 0, onClose }) {
  const { t } = useI18n();
  const [i, setI] = useState(start);
  const [z, setZ] = useState(0); // index into STEPS
  const total = pages.length;
  const page = pages[i];

  const go = useCallback((d) => { setI((n) => Math.min(total - 1, Math.max(0, n + d))); setZ(0); }, [total]);
  const zoom = useCallback((d) => setZ((n) => Math.min(STEPS.length - 1, Math.max(0, n + d))), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoom(1);
      else if (e.key === "-") zoom(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [go, zoom, onClose]);

  const zoomed = STEPS[z] > 1;
  const tbtn = "grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.article.scan} dir="ltr" className="fixed inset-0 z-[100] flex flex-col bg-black/95 animate-fade">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="text-sm text-white/70">{total > 1 ? t.viewer.pageOf.replace("{n}", i + 1).replace("{total}", total) : ""}</span>
        <div className="flex items-center gap-2">
          <button className={tbtn} onClick={() => zoom(-1)} disabled={z === 0} aria-label={t.viewer.zoomOut}><Icon name="zoomOut" size={18} /></button>
          <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20" onClick={() => setZ(0)}>{Math.round(STEPS[z] * 100)}%</button>
          <button className={tbtn} onClick={() => zoom(1)} disabled={z === STEPS.length - 1} aria-label={t.viewer.zoomIn}><Icon name="zoomIn" size={18} /></button>
          <button className={tbtn} onClick={onClose} aria-label={t.viewer.close}><Icon name="x" size={18} /></button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-auto overscroll-contain" onDoubleClick={() => setZ((n) => (n === 0 ? 2 : 0))}>
          <div className={`flex min-h-full items-center justify-center p-2 ${zoomed ? "w-max min-w-full" : ""}`}>
            <img
              src={page.src}
              alt={page.caption || t.article.scan}
              draggable="false"
              style={zoomed ? { width: `${STEPS[z] * 100}vw`, maxWidth: "none" } : undefined}
              className={zoomed ? "h-auto" : "max-h-[calc(100vh-9rem)] max-w-full object-contain"}
            />
          </div>
        </div>
        {total > 1 && (
          <>
            <button className={`${tbtn} absolute start-3 top-1/2 -translate-y-1/2`} style={{ insetInlineStart: "0.75rem" }} onClick={() => go(-1)} disabled={i === 0} aria-label={t.viewer.prev}><Icon name="chevL" size={20} /></button>
            <button className={`${tbtn} absolute top-1/2 -translate-y-1/2`} style={{ insetInlineEnd: "0.75rem" }} onClick={() => go(1)} disabled={i === total - 1} aria-label={t.viewer.next}><Icon name="chevR" size={20} /></button>
          </>
        )}
      </div>
      {page.caption && <p className="px-4 py-3 text-center text-sm text-white/80">{page.caption}</p>}
    </div>,
    document.body
  );
}
