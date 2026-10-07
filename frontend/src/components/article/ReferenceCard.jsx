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
  const meta = [[t.article.author, r.author], [t.article.volume, r.volume], [t.article.page, r.page]].filter(([, v]) => v);

  return (
    <aside className="my-9 overflow-hidden rounded-xl border border-rule bg-card shadow-elev">
      <div className="p-5 sm:p-7">
        <p className="eyebrow flex items-center gap-2"><Icon name="book" size={14} />{t.article.reference}</p>
        <Text as="h4" className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">{r.book}</Text>

        {meta.length > 0 && (
          <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-x-6 gap-y-3 border-y border-rule py-4">
            {meta.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-mute rtl:tracking-normal">{label}</dt>
                <Text as="dd" className="mt-0.5 text-sm font-medium">{value}</Text>
              </div>
            ))}
          </dl>
        )}

        {r.referenceText && (
          <blockquote className="mt-5">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-mute rtl:tracking-normal">{t.article.text}</span>
            <Text as="p" className="text-[1.05rem] leading-relaxed">{r.referenceText}</Text>
          </blockquote>
        )}

        {scan && (
          isPdfKey(r.mediaKey) ? (
            <a href={scan} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5"><Icon name="file" size={16} />{t.article.openPdf}</a>
          ) : (
            <button onClick={() => setOpen(true)} className="group mt-5 block w-full overflow-hidden rounded-lg border border-rule text-start transition hover:border-accent/60 sm:w-72" aria-label={t.article.openScan}>
              <img src={scan} alt={t.article.scan} loading="lazy" decoding="async" className="max-h-48 w-full bg-rule/30 object-cover object-top" />
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
