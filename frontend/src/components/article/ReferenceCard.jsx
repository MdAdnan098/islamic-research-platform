import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl, isPdfKey } from "../../lib/media.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";
import { ScanViewer } from "./ScanViewer.jsx";

/** Scholarly citation: Book → Author → Volume → Page → Text → Scanned page. */
export function ReferenceCard({ reference: r }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const scan = mediaUrl(r.mediaKey);
  // One compact line, like a citation: Book · Author · Jild · Safha
  const line = [r.book, r.author, r.volume && `${t.article.volume} ${r.volume}`, r.page && `${t.article.page} ${r.page}`].filter(Boolean).join(" · ");

  return (
    <aside className="card-lift my-9 overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="p-3.5 sm:p-5">
        {/* fixed colours on purpose (do not change with the theme) */}
        <Text as="p" className="rounded-xl border-2 px-4 py-2.5 text-[1.05rem] font-semibold leading-snug sm:text-lg" style={{ background: "#e0efff", borderColor: "#3b82f6", color: "#1e3a8a" }}>{line}</Text>

        {r.referenceText && (
          <Text as="p" className="mt-4 text-[1.05rem] leading-relaxed sm:text-lg">{r.referenceText}</Text>
        )}

        {scan && (
          isPdfKey(r.mediaKey) ? (
            <a href={scan} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5"><Icon name="file" size={16} />{t.article.openPdf}</a>
          ) : (
            <button onClick={() => setOpen(true)} className="group mt-5 block w-full overflow-hidden rounded-lg border border-rule text-start transition hover:border-accent/60" aria-label={t.article.openScan}>
              <img src={scan} alt={t.article.scan} loading="lazy" decoding="async" className="block h-auto w-full bg-rule/30" />
              <span className="flex items-center justify-between bg-paper px-3 py-2 text-xs font-medium text-bronze">
                {t.article.openScan}<Icon name="zoomIn" size={15} />
              </span>
            </button>
          )
        )}
      </div>
      {open && <ScanViewer pages={[{ src: scan, caption: [r.book, r.page && `${t.article.page} ${r.page}`].filter(Boolean).join(" · ") }]} onClose={() => setOpen(false)} />}
    </aside>
  );
}
