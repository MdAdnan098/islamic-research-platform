import { useState } from "react";
import { Modal } from "./ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { targetLangs, isConvertible, buildCopyText, parsePaste, applyPaste } from "../../lib/versions.js";

/**
 * Whole-article conversion helper: copy every text block as numbered text,
 * convert it elsewhere (ChatGPT etc.), then paste it back — each part lands in
 * its own block, so the structure (paragraph / image / paragraph...) is built once.
 */
export function VersionsPanel({ baseLang, title, titleTr, setTitleTr, blocks, setBlocks, toast }) {
  const [paste, setPaste] = useState(null); // { lang, label, text }
  const langs = targetLangs(baseLang);
  const convertible = blocks.filter(isConvertible);

  async function copy(lang) {
    try {
      await navigator.clipboard.writeText(buildCopyText(lang, title, blocks));
      toast("Copy ho gaya — ab ChatGPT mein paste karke convert karwayein");
    } catch { toast("Copy nahi ho paya", "error"); }
  }

  function apply() {
    const r = applyPaste(paste.lang, parsePaste(paste.text), titleTr, blocks);
    if (!r.count) return toast("Koi [number] wala hissa nahi mila. Text waisa hi paste karein jaisa ChatGPT ne diya.", "error");
    setBlocks(r.blocks); setTitleTr(r.titleTr); setPaste(null);
    toast(`${r.count} hisse bhar gaye`);
  }

  return (
    <div className="a-card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Doosri zabaan ke versions</h2>
      {langs.map(([code, label]) => {
        const done = convertible.filter((b) => b.tr?.[code]?.trim()).length;
        return (
          <div key={code} className="flex flex-wrap items-center gap-2 rounded-lg border border-ad-rule p-2.5">
            <span className="min-w-[110px] text-sm font-medium">{label} <span className="text-xs font-normal text-ad-mute">{done}/{convertible.length}</span></span>
            <button type="button" className="a-btn !py-1.5 text-xs" onClick={() => copy(code)}><Icon name="file" size={14} />{label} ke liye copy</button>
            <button type="button" className="a-btn !py-1.5 text-xs" onClick={() => setPaste({ lang: code, label, text: "" })}><Icon name="plus" size={14} />{label} version paste karein</button>
          </div>
        );
      })}
      {paste && (
        <Modal title={`${paste.label} version paste karein`} wide onClose={() => setPaste(null)}>
          <textarea className="a-input" rows={14} dir="auto" autoFocus placeholder="[0] ... [1] ... jaisa ChatGPT ne diya, poora yahan paste karein" value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="a-btn" onClick={() => setPaste(null)}>Cancel</button>
            <button type="button" className="a-btn-primary" onClick={apply}>Lagayein</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
