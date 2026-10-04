import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { scriptOf } from "../../lib/script.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";
import { ReferenceCard } from "./ReferenceCard.jsx";
import { ScanViewer } from "./ScanViewer.jsx";

function Quote({ b }) {
  const { t } = useI18n();
  const sacred = b.kind === "ayat" || b.kind === "hadith";
  const s = scriptOf(b.text);
  const big = sacred && (s === "arabic" || s === "urdu");
  return (
    <figure className="my-9 rounded-xl border border-rule bg-card px-6 py-7 sm:px-9">
      {sacred && <p className="eyebrow mb-3">{b.kind === "ayat" ? t.article.ayat : t.article.hadith}</p>}
      <Text as="blockquote" force={big ? "arabic" : undefined} className={big ? "text-[1.7rem] leading-[2.2] sm:text-[2rem]" : "font-display text-xl italic leading-relaxed"}>{b.text}</Text>
      {b.source && <Text as="figcaption" className="mt-4 text-sm text-bronze">— {b.source}</Text>}
    </figure>
  );
}

function Figure({ pages, caption, startOpen }) {
  const [open, setOpen] = useState(null);
  const single = pages.length === 1;
  return (
    <figure className="my-9">
      <div className={single ? "" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
        {pages.map((p, i) => (
          <button key={i} onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-lg border border-rule bg-card text-start transition hover:border-accent/60" aria-label={p.caption || "Open"}>
            <img src={p.src} alt={p.alt || p.caption || ""} loading="lazy" decoding="async" className={`w-full bg-rule/30 ${single ? "" : "aspect-[3/4] object-cover object-top"}`} />
          </button>
        ))}
      </div>
      {caption && <Text as="figcaption" className="mt-3 text-center text-sm text-mute">{caption}</Text>}
      {open !== null && <ScanViewer pages={pages} start={open} onClose={() => setOpen(null)} />}
    </figure>
  );
}

function Pdf({ b }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState(false);
  const url = mediaUrl(b.key);
  if (!url) return null;
  return (
    <div className="my-9 rounded-xl border border-rule bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-rule/50 text-bronze"><Icon name="file" size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t.article.pdf}</p>
          <Text as="p" className="mt-0.5 truncate font-medium">{b.title || "PDF"}</Text>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview((p) => !p)} className="btn-outline !px-4 !py-2">{t.article.preview}</button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2"><Icon name="external" size={15} />{t.article.openPdf}</a>
        </div>
      </div>
      {preview && <iframe src={url} title={b.title || "PDF"} className="mt-4 h-[70vh] w-full rounded-lg border border-rule" />}
    </div>
  );
}

export function BlockRenderer({ blocks = [], references = [] }) {
  const refMap = Object.fromEntries(references.map((r) => [r.id, r]));
  return (
    <div className="reading">
      {blocks.map((b, i) => {
        const key = b.id || i;
        switch (b.type) {
          case "heading":
            return b.level === 3
              ? <Text key={key} as="h3" className="mb-3 mt-10 font-display text-xl font-semibold sm:text-2xl">{b.text}</Text>
              : <Text key={key} as="h2" className="mb-4 mt-14 border-t border-rule pt-8 font-display text-2xl font-semibold sm:text-3xl">{b.text}</Text>;
          case "text":
            return (
              <div key={key} className="my-5">
                {String(b.text || "").split(/\n{2,}/).filter(Boolean).map((p, j) => <Text key={j} as="p" className="whitespace-pre-line">{p}</Text>)}
              </div>
            );
          case "quote":
            return <Quote key={key} b={b} />;
          case "reference":
            return refMap[b.referenceId] ? <ReferenceCard key={key} reference={refMap[b.referenceId]} /> : null;
          case "image":
            return b.key ? <Figure key={key} pages={[{ src: mediaUrl(b.key), alt: b.alt, caption: b.caption }]} caption={b.caption} /> : null;
          case "scan": {
            const pages = (b.pages || []).filter((p) => p.key).map((p) => ({ src: mediaUrl(p.key), caption: p.caption }));
            return pages.length ? <Figure key={key} pages={pages} caption={b.caption} /> : null;
          }
          case "pdf":
            return <Pdf key={key} b={b} />;
          case "divider":
            return (
              <div key={key} className="my-12 flex items-center gap-4 text-gold" aria-hidden="true">
                <span className="h-px flex-1 bg-rule" /><span className="text-xs">◆</span><span className="h-px flex-1 bg-rule" />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
