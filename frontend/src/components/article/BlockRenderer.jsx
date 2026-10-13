import { Fragment, lazy, Suspense, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { isRtl, scriptOf, splitScriptRuns } from "../../lib/script.js";
import { pickRef, pickVersion } from "../../lib/versions.js";
import { Text, cleanText } from "../ui/Text.jsx";
import { rangesOf, shownLang, sliceRanges, splitByRanges, splitParagraphs } from "../../lib/highlights.js";
import { Icon } from "../ui/icons.jsx";
import { ReferenceCard } from "./ReferenceCard.jsx";
import { ScanViewer } from "./ScanViewer.jsx";

// Admin-only inline "add block" control: loaded on demand, so public visitors never download it.
const InlineAdd = lazy(() => import("../../admin/components/InlineAdd.jsx"));
// Admin-only inline "edit block" form (pencil under every block): also loaded on demand.
const InlineEdit = lazy(() => import("../../admin/components/InlineEdit.jsx"));
// Admin-only Edit / Up / Down / Delete buttons under every block: also loaded on demand.
const BlockTools = lazy(() => import("../../admin/components/BlockTools.jsx"));

const AR = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
const RTL_RUN = new RegExp(`[${AR}]+(?:[\\s\\u200c\\u200d.,:;!?()'"\\u201C\\u201D\\u00AB\\u00BB\\-\\u2013\\u2014]+[${AR}]+)*`, "g");
const HAS_AR = new RegExp(`[${AR}]`);
const URDU_ONLY = /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06C3\u06D2\u06D3\u06CC\u06A9\u06AF\u0686\u067E\u0698]/;

/**
 * Arabic / Urdu words inside a left-to-right line (Roman or Hindi) are wrapped as their own right-to-left run
 * with the proper Arabic font, so they neither flip the surrounding words nor get odd spacing.
 * Same characters in, same characters out - highlight offsets are unaffected.
 */
function isolateRtl(str) {
  if (typeof str !== "string" || !HAS_AR.test(str)) return str;
  const out = [];
  let last = 0, m, n = 0;
  RTL_RUN.lastIndex = 0;
  while ((m = RTL_RUN.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(<span key={n++} dir="rtl" className={URDU_ONLY.test(m[0]) ? "inl-ur" : "inl-ar"}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

/** Text with its saved highlights as <mark> elements (plain string when there are none). Offsets are relative to `text`.
 *  `host` is the script of the line it sits in; inside a left-to-right host, Arabic runs are isolated (see isolateRtl). */
function marked(text, ranges, host) {
  const iso = host && !isRtl(host) ? isolateRtl : (x) => x;
  if (!ranges?.length) return iso(text);
  return splitByRanges(text, ranges).map((p, i) => (p.marked ? <mark key={i} className="hl-mark">{iso(p.text)}</mark> : <Fragment key={i}>{iso(p.text)}</Fragment>));
}

/** Only in highlight-editing mode: lets the admin toolbar map a selection back to (block, version, offset). */
const hlAttrs = (on, b, lang, start = 0) => (on && b.id ? { "data-hl-block": b.id, "data-hl-lang": lang, "data-hl-start": start } : {});

function Quote({ b, text, ranges, attrs }) {
  const { t } = useI18n();
  const sacred = b.kind === "ayat" || b.kind === "hadith";
  const s = scriptOf(b.text);
  const big = sacred && (s === "arabic" || s === "urdu");
  // Slight slant only where italics look right (Latin / Roman text); Arabic & Urdu scripts stay upright.
  const slant = s === "latin" ? "italic" : "not-italic";
  const mark = "pointer-events-none absolute select-none font-display text-[4.2rem] font-bold leading-none text-accent/25 sm:text-[6rem]";
  return (
    <figure className="card-lift relative my-9 overflow-hidden rounded-2xl border border-rule bg-card px-6 pb-10 pt-11 sm:px-12 sm:pb-14 sm:pt-16">
      <span aria-hidden="true" className={`${mark} left-4 top-1 sm:left-6`}>&ldquo;</span>
      <span aria-hidden="true" className={`${mark} bottom-[-1.9rem] right-4 sm:bottom-[-3.2rem] sm:right-6`}>&rdquo;</span>
      {sacred && <p className="eyebrow relative mb-3">{b.kind === "ayat" ? t.article.ayat : t.article.hadith}</p>}
      <Text as="blockquote" src={text} force={big ? s : undefined} {...attrs} className={`relative ${big ? (s === "urdu" ? "sacred-urdu text-[1.1rem] sm:text-[1.4rem]" : "sacred-arabic text-[1.55rem] sm:text-[2rem]") : `font-display text-[0.85rem] leading-[1.8] sm:text-base lg:text-lg ${slant}`}`}>{marked(cleanText(text), ranges, s)}</Text>
      {b.source && <Text as="figcaption" className="relative mt-3 text-xs text-bronze sm:text-sm">— {b.source}</Text>}
    </figure>
  );
}

function Figure({ pages, caption, startOpen }) {
  const [open, setOpen] = useState(null);
  const single = pages.length === 1;
  return (
    <figure className="my-9">
      <div className={single ? "" : "flex flex-col gap-4"}>
        {pages.map((p, i) => (
          <button key={i} onClick={() => setOpen(i)} className={`card-lift block w-full overflow-hidden rounded-lg border border-rule bg-card text-start`} aria-label={p.caption || "Open"}>
            <img src={p.src} alt={p.alt || p.caption || ""} loading="lazy" decoding="async" className="block h-auto w-full bg-rule/30" />
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
    <div className="card-lift my-9 rounded-2xl border border-rule bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-rule/50 text-bronze"><Icon name="file" size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t.article.pdf}</p>
            <Text as="p" className="mt-0.5 break-words text-[0.95rem] font-medium leading-snug sm:text-base">{b.title || "PDF"}</Text>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:shrink-0">
          <button onClick={() => setPreview((p) => !p)} className="btn-outline whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4">{t.article.preview}</button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4"><Icon name="external" size={15} />{t.article.openPdf}</a>
        </div>
      </div>
      {preview && <iframe src={url} title={b.title || "PDF"} className="mt-4 h-[70vh] w-full rounded-lg border border-rule" />}
    </div>
  );
}

export function BlockRenderer({ blocks = [], references = [], baseLang = "ur", hlEdit = false, inline, edit }) {
  const { contentLang } = useI18n();
  const [editingKey, setEditingKey] = useState(null); // the block whose inline editor is open (admin only)
  const txt = (b) => (b.kind === "ayat" || b.kind === "hadith" ? b.text : pickVersion(b.text, b.tr, baseLang, contentLang));
  const refMap = Object.fromEntries(references.map((r) => [r.id, r]));
  function renderBlock(b, i) {
        const key = b.id || i;
        const lang = shownLang(b, baseLang, contentLang); // which script version is on screen = which highlight set applies
        const ranges = rangesOf(b, lang);
        switch (b.type) {
          case "heading": {
            const text = cleanText(txt(b));
            const attrs = hlAttrs(hlEdit, b, lang);
            const host = scriptOf(text);
            return b.level === 3
              ? <Text key={key} as="h3" src={text} {...attrs} className="mb-3 mt-10 font-display text-xl font-semibold sm:text-2xl">{marked(text, ranges, host)}</Text>
              : <Text key={key} as="h2" src={text} {...attrs} className="mb-4 mt-14 border-t border-rule pt-8 font-display text-2xl font-semibold sm:text-3xl">{marked(text, ranges, host)}</Text>;
          }
          case "text":
            return (
              <div key={key} className="my-5">
                {splitParagraphs(cleanText(txt(b))).flatMap((seg) => splitScriptRuns(seg.text, seg.start)).map((run, j) => (
                  // Each run of same-script lines is its own paragraph with its own direction (offsets stay relative to the whole block).
                  <Text key={j} as="p" src={run.text} force={run.script} {...hlAttrs(hlEdit, b, lang, run.start)} className="whitespace-pre-line">
                    {marked(run.text, sliceRanges(ranges, run.start, run.start + run.text.length), run.script)}
                  </Text>
                ))}
              </div>
            );
          case "quote":
            return <Quote key={key} b={b} text={txt(b)} ranges={ranges} attrs={hlAttrs(hlEdit, b, lang)} />;
          case "reference":
            return refMap[b.referenceId] ? <ReferenceCard key={key} reference={pickRef(refMap[b.referenceId], b.tr, baseLang, contentLang)} /> : null;
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
  }

  return (
    <div className="reading">
      {inline && blocks.length === 0 && <Suspense fallback={null}><InlineAdd backupKey={inline.scope ? `fs_add:${inline.scope}:start` : undefined} onInsert={(block) => inline.onInsert(-1, block, null)} /></Suspense>}
      {blocks.map((b, i) => {
        const key = b.id || i;
        const editing = !!edit && editingKey === key;
        // Reference blocks keep their converted fields per reader language, other blocks per shown script version.
        const editLang = b.type === "reference" ? contentLang : shownLang(b, baseLang, contentLang);
        return (
        <Fragment key={key}>
          {editing
            ? <Suspense fallback={null}><InlineEdit block={b} baseLang={baseLang} lang={editLang} onCancel={() => setEditingKey(null)} saveLabel={edit.saveLabel} onSave={async (nb) => { await edit.onSave(i, nb); setEditingKey(null); }} /></Suspense>
            : renderBlock(b, i)}
          {edit && !editing && (
            <Suspense fallback={null}>
              <BlockTools
                index={i} count={blocks.length} block={b}
                onEdit={b.type !== "divider" ? () => setEditingKey(key) : null}
                onMove={edit.onMove ? (dir) => edit.onMove(i, dir, b.id || null) : null}
                onRemove={edit.onRemove ? () => edit.onRemove(i, b.id || null) : null}
              />
            </Suspense>
          )}
          {inline && <Suspense fallback={null}><InlineAdd backupKey={inline.scope ? `fs_add:${inline.scope}:${key}` : undefined} onInsert={(block) => inline.onInsert(i, block, b.id || null)} /></Suspense>}
        </Fragment>
        );
      })}
    </div>
  );
}
