import { useMemo, useState } from "react";
import { BLOCK_META } from "../../lib/blocks.js";
import { remapRanges, withTextEdit } from "../../lib/highlights.js";
import { VERSION_LANGS } from "../../lib/versions.js";
import { Fields } from "./BlockEditor.jsx";
import { Field, ToastProvider } from "./ui.jsx";

const TEXTY = new Set(["heading", "text", "quote"]);
const isSacred = (b) => b.type === "quote" && (b.kind === "ayat" || b.kind === "hadith");
const REF_FIELDS = [["book", "Book"], ["author", "Author"], ["volume", "Volume"], ["page", "Page"], ["referenceText", "Text"]];
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Sets the text of one converted version (block.tr[lang]) and keeps that version's highlights on the same words. */
function withVersionText(block, lang, text) {
  const next = { ...block, tr: { ...(block.tr || {}), [lang]: text } };
  const marks = block.hl?.[lang];
  if (marks?.length) {
    const mapped = remapRanges(block.tr?.[lang] || "", text, marks);
    const hl = { ...block.hl };
    if (mapped.length) hl[lang] = mapped; else delete hl[lang];
    if (Object.keys(hl).length) next.hl = hl; else delete next.hl;
  }
  return next;
}

/** What is missing before this block may be saved ("" when fine). */
function problem(b, onVersion, lang) {
  if (TEXTY.has(b.type)) {
    const shown = onVersion ? b.tr?.[lang] : b.text;
    if (!String(shown || "").trim()) return "Text khali nahi ho sakta.";
  }
  if (b.type === "reference" && !b.referenceId) return "Reference chuniye.";
  if (b.type === "image" && !b.key) return "Pehle image upload karein.";
  if (b.type === "pdf" && !b.key) return "Pehle PDF upload karein.";
  if (b.type === "scan" && !(b.pages || []).some((p) => p.key)) return "Kam se kam ek page upload karein.";
  return "";
}

/**
 * Admin-only: edits ONE block of the post right where it is shown. What is edited is the version on screen:
 * Roman / Urdu text edits that script's converted text, the author's own script edits the base text.
 * The "Save & Publish" button appears as soon as something is changed; saving stores the whole post and publishes it.
 */
export default function InlineEdit({ block, baseLang, lang, onSave, onCancel }) {
  const [draft, setDraft] = useState(block);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onVersion = TEXTY.has(block.type) && !isSacred(block) && lang !== baseLang;
  const refVersion = block.type === "reference" && lang !== baseLang && isObj(block.tr?.[lang]);
  const label = VERSION_LANGS.find(([c]) => c === lang)?.[1] || "";
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(block), [draft, block]);

  const set = (p) => {
    setErr("");
    setDraft((d) => {
      const { text, ...rest } = p;
      const next = text !== undefined ? withTextEdit(d, baseLang, text) : d;
      return { ...next, ...rest };
    });
  };
  const setVersion = (text) => { setErr(""); setDraft((d) => withVersionText(d, lang, text)); };
  const setRefField = (k, v) => { setErr(""); setDraft((d) => ({ ...d, tr: { ...(d.tr || {}), [lang]: { ...(d.tr?.[lang] || {}), [k]: v } } })); };

  async function save() {
    const msg = problem(draft, onVersion, lang);
    if (msg) return setErr(msg);
    setBusy(true);
    try { await onSave(draft); } catch (e) { setErr(e?.message || "Save nahi ho paya."); setBusy(false); }
  }

  return (
    <ToastProvider>
      <div dir="ltr" className="my-4 space-y-3 rounded-xl border border-accent/50 bg-card p-3.5 font-sans text-base text-ink shadow-soft">
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-mute">
          <span>✏ {BLOCK_META[block.type]?.label} edit</span>
          {(onVersion || refVersion) && <span className="rounded-full bg-rule/50 px-2 py-0.5">{label} version</span>}
          {TEXTY.has(block.type) && !onVersion && !isSacred(block) && <span className="rounded-full bg-rule/50 px-2 py-0.5">{VERSION_LANGS.find(([c]) => c === baseLang)?.[1]} (aapka likha hua)</span>}
        </p>

        {onVersion ? (
          <div className="space-y-3">
            <Field label={`${label} text`} hint={block.type === "text" ? "Paragraphs ke beech ek khali line rakhein." : undefined}>
              {block.type === "heading"
                ? <input className="a-input" dir="auto" value={draft.tr?.[lang] || ""} onChange={(e) => setVersion(e.target.value)} />
                : <textarea className="a-input" dir="auto" rows={block.type === "text" ? 7 : 4} value={draft.tr?.[lang] || ""} onChange={(e) => setVersion(e.target.value)} />}
            </Field>
            {block.type === "heading" && (
              <Field label="Level">
                <select className="a-input" value={draft.level || 2} onChange={(e) => set({ level: Number(e.target.value) })}><option value={2}>H2 (section)</option><option value={3}>H3 (sub)</option></select>
              </Field>
            )}
            {block.type === "quote" && <Field label="Source"><input className="a-input" dir="auto" value={draft.source || ""} onChange={(e) => set({ source: e.target.value })} /></Field>}
          </div>
        ) : refVersion ? (
          <div className="space-y-3">
            {REF_FIELDS.map(([k, name]) => (
              <Field key={k} label={name}>
                {k === "referenceText"
                  ? <textarea className="a-input" dir="auto" rows={3} value={draft.tr?.[lang]?.[k] || ""} onChange={(e) => setRefField(k, e.target.value)} />
                  : <input className="a-input" dir="auto" value={draft.tr?.[lang]?.[k] || ""} onChange={(e) => setRefField(k, e.target.value)} />}
              </Field>
            ))}
          </div>
        ) : (
          <Fields block={draft} set={set} />
        )}

        {err && <p role="alert" className="text-sm text-ad-danger">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <button type="button" className="a-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save & Publish"}</button>}
          <button type="button" className="a-btn" disabled={busy} onClick={onCancel}>{dirty ? "Cancel" : "Band karein"}</button>
          {!dirty && <span className="text-xs text-mute">Kuch badalte hi yahan Save &amp; Publish button aa jayega.</span>}
        </div>
      </div>
    </ToastProvider>
  );
}
