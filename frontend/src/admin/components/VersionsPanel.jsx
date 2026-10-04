import { useState } from "react";
import { Modal } from "./ui.jsx";
import { VERSION_LANGS, isConvertible, buildCopyText, parsePaste, applyPaste } from "../../lib/versions.js";

/**
 * One card under the post: for each language, "copy" -> convert elsewhere -> "paste".
 * The post structure (paragraph / image / paragraph ...) is built once above;
 * pasted text drops into the matching block by its [number].
 */
export function VersionsPanel({ baseLang, title, titleTr, setTitleTr, blocks, setBlocks, toast }) {
  const [paste, setPaste] = useState(null); // { lang, label, text }
  const total = blocks.filter(isConvertible).length;

  async function copy(lang, label) {
    try {
      await navigator.clipboard.writeText(buildCopyText(lang, title, blocks));
      toast(`Copy ho gaya. Ab ChatGPT mein paste karke ${label} mein convert karwayein.`);
    } catch { toast("Copy nahi ho paya", "error"); }
  }

  function apply() {
    const r = applyPaste(paste.lang, parsePaste(paste.text), titleTr, blocks);
    if (!r.count) return toast("Koi [number] wala hissa nahi mila. ChatGPT ka jawab waisa hi paste karein jaisa mila.", "error");
    setBlocks(r.blocks); setTitleTr(r.titleTr); setPaste(null);
    toast(`${r.count} hisse apni jagah par lag gaye`);
  }

  return (
    <div className="a-card space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">Doosri zabaan ke versions banayein</h2>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-ad-mute">
          <li>Upar poora post likh lein.</li>
          <li>Jis zabaan ka version chahiye, uske <b>Copy</b> button par dabayein.</li>
          <li>ChatGPT mein paste karke convert karwayein, aur uska jawab copy karein.</li>
          <li>Yahan wapas aakar <b>Paste</b> button dabayein aur paste kar dein.</li>
        </ol>
      </div>
      {VERSION_LANGS.map(([code, label]) => {
        const mine = code === baseLang;
        const done = blocks.filter((b) => isConvertible(b) && b.tr?.[code]?.trim()).length;
        return (
          <div key={code} className="space-y-2 rounded-lg border border-ad-rule p-3">
            <p className="text-sm font-semibold">{label} version {!mine && <span className="ms-1 text-xs font-normal text-ad-mute">{done}/{total} hisse bhare</span>}</p>
            {mine ? (
              <p className="text-sm text-green-700">✓ Aapne post isi zabaan mein likhi hai</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="a-btn" onClick={() => copy(code, label)}>1. {label} version ke liye post copy karein</button>
                <button type="button" className="a-btn-primary" onClick={() => setPaste({ lang: code, label, text: "" })}>2. ChatGPT se converted {label} version yahan paste karein</button>
              </div>
            )}
          </div>
        );
      })}
      {paste && (
        <Modal title={`${paste.label} version paste karein`} wide onClose={() => setPaste(null)}>
          <textarea className="a-input" rows={14} dir="auto" autoFocus placeholder="ChatGPT ka poora jawab yahan paste karein" value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="a-btn" onClick={() => setPaste(null)}>Cancel</button>
            <button type="button" className="a-btn-primary" onClick={apply}>Paste karein</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
