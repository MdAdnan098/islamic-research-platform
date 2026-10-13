import { useEffect, useState } from "react";
import { newBlock } from "../../lib/blocks.js";
import { BLOCK_META } from "../../lib/blocks.js";
import { Icon } from "../../components/ui/icons.jsx";
import { Fields, MENU_GROUPS } from "./BlockEditor.jsx";
import { ToastProvider } from "./ui.jsx";

/** Is the draft filled in enough to be added? Returns an error message, or "" when fine. */
function problem(b) {
  if (["heading", "text", "quote"].includes(b.type) && !String(b.text || "").trim()) return "Pehle text likhein.";
  if (b.type === "reference" && !b.referenceId) return "Reference chuniye.";
  if (b.type === "image" && !b.key) return "Pehle image upload karein.";
  if (b.type === "pdf" && !b.key) return "Pehle PDF upload karein.";
  if (b.type === "scan" && !(b.pages || []).some((p) => p.key)) return "Kam se kam ek page upload karein.";
  return "";
}

/* The half-written block is kept in this browser (localStorage) until it is saved or cancelled, so a page reload
   (for example Chrome refreshing a tab you switched away from) never loses what was pasted into the form. */
const readBackup = (key) => { try { const v = key && localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeBackup = (key, v) => { try { if (key) { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v)); } } catch { /* ignore */ } };

function Draft({ initial, onSave, onCancel, backupKey, restored }) {
  const [block, setBlock] = useState(initial);
  useEffect(() => { if (backupKey) writeBackup(backupKey, block); }, [block, backupKey]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p) => { setErr(""); setBlock((b) => ({ ...b, ...p })); };

  async function save() {
    const msg = problem(block);
    if (msg) return setErr(msg);
    setBusy(true);
    try { await onSave(block); } catch (e) { setErr(e?.message || "Save nahi ho paya."); setBusy(false); }
  }

  return (
    <ToastProvider>
      <div dir="ltr" className="my-3 space-y-3 rounded-xl border border-rule bg-card p-3.5 font-sans text-base text-ink shadow-soft">
        <p className="flex items-center gap-2 text-xs font-semibold text-mute"><span className="w-4 text-center">{BLOCK_META[block.type]?.icon}</span>Naya {BLOCK_META[block.type]?.label}{restored && <span className="rounded-full bg-rule/50 px-2 py-0.5">pichla adhura likha hua wapas aaya</span>}</p>
        <Fields block={block} set={set} />
        {err && <p role="alert" className="text-sm text-ad-danger">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="a-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="a-btn" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </ToastProvider>
  );
}

/**
 * Admin-only: a small "+ Add" button shown under a block of the post. It opens the same block choices as
 * "Insert below" in the editor; the new block is filled in right here and saved straight into the post,
 * so the admin never has to go back to the dashboard.
 */
export default function InlineAdd({ onInsert, backupKey, tools = null }) {
  const [menu, setMenu] = useState(false);
  const [restored] = useState(() => readBackup(backupKey));
  const [draft, setDraft] = useState(restored);
  const closeDraft = () => { writeBackup(backupKey, null); setDraft(null); };

  if (draft) {
    return <Draft initial={draft} backupKey={backupKey} restored={!!restored && draft === restored} onCancel={closeDraft} onSave={async (b) => { await onInsert(b); closeDraft(); }} />;
  }
  return (
    <div dir="ltr" className="my-0 font-sans">
      <div className="flex items-center gap-2 opacity-40 transition-opacity focus-within:opacity-100 hover:opacity-100">
        <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rule bg-card/70 px-2.5 py-0 text-[11px] font-semibold leading-5 text-mute transition hover:border-accent/60 hover:text-ink">
          <Icon name="plus" size={12} />Add
        </button>
        <span className="h-px flex-1 border-t border-dashed border-rule" aria-hidden="true" />
        {tools}
      </div>
      {menu && (
        <div className="mt-2 space-y-2 rounded-xl border border-rule bg-card p-2 text-ink shadow-soft">
          {MENU_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-mute">{g.title}</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {g.types.map((t) => (
                  <button key={t} type="button" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm hover:bg-rule/40" onClick={() => { setMenu(false); setDraft(newBlock(t)); }}>
                    <span className="w-4 shrink-0 text-center text-mute">{BLOCK_META[t].icon}</span>{BLOCK_META[t].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
