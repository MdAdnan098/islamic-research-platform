import { useState } from "react";
import { BLOCK_META } from "../../lib/blocks.js";
import { Icon } from "../../components/ui/icons.jsx";
import { useConfirm, useToast } from "./ui.jsx";

const btn = "inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-0.5 text-[11px] font-semibold text-mute opacity-70 transition hover:border-accent/60 hover:text-ink hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-rule disabled:hover:text-mute";

/**
 * Admin-only: the small button row shown under every block of the post -
 * Edit, move Up, move Down and Delete (Delete always asks "Yes, delete / Cancel" first).
 * Loaded on demand, so public visitors never download it.
 */
export default function BlockTools({ index, count, block, onEdit, onMove, onRemove }) {
  const [confirm, dialog] = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const label = BLOCK_META[block.type]?.label || "hissa";

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast(e?.message || "Nahi ho paya. Dobara koshish karein.", "error"); } finally { setBusy(false); }
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete karein?",
      message: `Kya aap ye ${label} delete karna chahte hain? Delete karne par ye post se hat jayega.`,
      confirm: "Yes, Delete",
      danger: true,
    });
    if (ok) await run(onRemove);
  }

  return (
    <div dir="ltr" className="my-1 flex flex-wrap items-center gap-1.5 font-sans">
      {onEdit && <button type="button" disabled={busy} onClick={onEdit} aria-label={`Edit this ${label}`} className={btn}><Icon name="edit" size={12} />Edit</button>}
      {onMove && <button type="button" disabled={busy || index <= 0} onClick={() => run(() => onMove(-1))} aria-label={`Move this ${label} up`} className={btn}><Icon name="up" size={12} />Up</button>}
      {onMove && <button type="button" disabled={busy || index >= count - 1} onClick={() => run(() => onMove(1))} aria-label={`Move this ${label} down`} className={btn}><Icon name="down" size={12} />Down</button>}
      {onRemove && <button type="button" disabled={busy} onClick={remove} aria-label={`Delete this ${label}`} className={`${btn} hover:!border-ad-danger/60 hover:!text-ad-danger`}><Icon name="trash" size={12} />Delete</button>}
      {dialog}
    </div>
  );
}
