import { useEffect, useMemo, useState } from "react";
import { pairUnits, unitChoices } from "../../lib/blockAlign.js";

const NAMES = { en: "Roman", hi: "Hindi", ur: "Urdu" };
const LEVELS = [["sentence", "Jumla"], ["line", "Line"], ["para", "Paragraph"]];

/**
 * Manual correction of a block's cross-script mapping. Shown when Roman / Hindi / Urdu lines could not be matched with certainty.
 * For every unit of the ORIGINAL version the admin picks the matching unit of each other version (or "none"). Saving stores the
 * pairs with permanent unit ids (lib/blockAlign.js pairUnits); formatting then follows these pairs - never counts or positions.
 */
export default function AlignEditor({ block, baseLang, onSave, onClose }) {
  const first = LEVELS.some(([k]) => k === block.align?.level) ? block.align.level : "sentence";
  const [level, setLevel] = useState(first);
  const choices = useMemo(() => unitChoices(block, baseLang, level), [block, baseLang, level]);
  const [pairs, setPairs] = useState(choices.initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPairs(choices.initial); setError(""); }, [choices]);
  const others = Object.keys(choices.texts).filter((l) => l !== baseLang);

  const pick = (lang, i, value) => setPairs((cur) => ({ ...cur, [lang]: (cur[lang] || []).map((v, k) => (k === i ? (value === "" ? null : Number(value)) : v)) }));
  async function save() {
    const res = pairUnits(block, baseLang, level, pairs);
    if (res.error) { setError(res.error); return; }
    setBusy(true); setError("");
    try { await onSave(res.align); onClose(); } catch (e) { setError(e?.message || "Save nahi hua"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Lines match karein" onMouseDown={(e) => e.stopPropagation()}>
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-rule bg-paper p-4 text-ink shadow-elev" dir="ltr">
        <h2 className="text-base font-semibold">Lines match karein</h2>
        <p className="mt-1 text-xs text-mute">{NAMES[baseLang]} (original) ki har line ke saamne dusri zabaan ki wahi line chunein. Tarteeb same rehni chahiye. Jo line match na ho use &quot;— koi nahi —&quot; rakhein.</p>
        <div className="mt-2 flex gap-1.5">
          {LEVELS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setLevel(k)} className={`rounded-full border px-3 py-1 text-xs ${level === k ? "border-ink bg-tint font-semibold" : "border-rule"}`}>{label}</button>
          ))}
        </div>
        <ol className="mt-3 space-y-3">
          {choices.src.map((u, i) => (
            <li key={i} className="rounded-xl border border-rule p-2">
              <p dir="auto" className="text-sm"><span className="me-1 text-mute">{i + 1}.</span>{u.text}</p>
              {others.map((l) => (
                <label key={l} className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-mute">{NAMES[l]}</span>
                  <select value={pairs[l]?.[i] ?? ""} onChange={(e) => pick(l, i, e.target.value)} className="min-w-0 flex-1 rounded-lg border border-rule bg-card p-1.5" dir="auto">
                    <option value="">— koi nahi —</option>
                    {choices.parts[l].map((t, j) => <option key={j} value={j}>{`${j + 1}. ${t.text.slice(0, 60)}`}</option>)}
                  </select>
                </label>
              ))}
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-rule px-4 py-2 text-sm">Cancel</button>
          <button type="button" disabled={busy} onClick={save} className="btn-cta rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
