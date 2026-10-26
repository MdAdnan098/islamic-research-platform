import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl, isPdfKey } from "../../lib/media.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";
import { isRtl, scriptOf } from "../../lib/script.js";
import { ScanViewer } from "./ScanViewer.jsx";

// Old content may already carry the "Hawala" label / 📖 / ":-" / [ ] brackets: strip them so they are never shown twice.
const LABEL_RE = /^\s*(?:📖\s*)?(?:hawala|hawale|حوالہ|حوالے|हवाला|हवाले)(?![\p{L}\p{M}])\s*(?:📖)?\s*[:：\-–—]*\s*/iu;
const BRACKET_RE = /^[\[［【]\s*([\s\S]*?)\s*[\]］】]$/;

// The UI dictionary is always Roman, so the label follows the reader's selected language instead.
const LABELS = { en: "Hawala", ur: "حوالہ", hi: "हवाला" };

/** Plain reference text -> "[ text ]" (one bracketed line per source line), with any existing label/brackets removed first. */
function toBracketed(text) {
  const body = String(text ?? "").replace(LABEL_RE, "");
  return body
    .split("\n")
    .map((l) => {
      let x = l.trim(), m;
      while ((m = x.match(BRACKET_RE))) x = m[1].trim();
      return x;
    })
    .filter(Boolean)
    .map((x) => `[ ${x} ]`)
    .join("\n");
}

/** Scholarly citation. New references are a single free-text field; older ones (Book / Author / Volume / Page) still render as before. */
export function ReferenceCard({ reference: r }) {
  const { t, contentLang } = useI18n();
  const [open, setOpen] = useState(false);
  const scan = mediaUrl(r.mediaKey);
  // One compact line, like a citation: Book · Author · Jild · Safha
  const oldLine = [r.book, r.author, r.volume && `${t.article.volume} ${r.volume}`, r.page && `${t.article.page} ${r.page}`].filter(Boolean).join(" · ");
  // Single-field reference: its text goes in the highlighted box; an old-style reference keeps its citation line + text below.
  const line = toBracketed(oldLine || r.referenceText || "");
  const dir = isRtl(scriptOf(line)) ? "rtl" : "ltr";
  const below = oldLine ? r.referenceText : "";

  return (
    <aside className="my-6">
      <div>
        {/* Plain book-style citation: "Hawala :-" then "[ book jild safa ]". Colours live in index.css (.ref-line): blue in Light, soft blue in Dark. */}
        {line && (
          <div className="ref-line">
            <Text as="p" dir={dir} className="text-[0.9em] font-semibold leading-snug sm:text-[1em]">{LABELS[contentLang] || LABELS.en} :-</Text>
            <Text as="p" className="whitespace-pre-line text-[0.9em] font-semibold leading-snug sm:text-[1em]">{line}</Text>
          </div>
        )}

        {below && (
          <Text as="p" className="mt-4 text-[0.95em] leading-relaxed sm:text-[1.05em]">{below}</Text>
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
      {open && <ScanViewer pages={[{ src: scan, caption: [r.book, r.page && `${t.article.page} ${r.page}`].filter(Boolean).join(" · ") || undefined }]} onClose={() => setOpen(false)} />}
    </aside>
  );
}
