import { useState } from "react";
import { BLOCK_META } from "../../lib/blocks.js";
import { Icon } from "../../components/ui/icons.jsx";
import { useConfirm, useToast } from "./ui.jsx";

const ib = "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] font-semibold text-mute transition hover:bg-rule/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-mute";

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

  // One thin, faint pill at the right edge under the block: it never competes with the text, and lights up on hover / touch.
  return (
    <div dir="ltr" className="my-0.5 flex justify-end font-sans opacity-50 transition-opacity focus-within:opacity-100 hover:opacity-100">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-rule/70 bg-card/70 px-1 py-0.5">
        {onEdit && <button type="button" disabled={busy} onClick={onEdit} title="Edit" aria-label={`Edit this ${label}`} className={ib}><Icon name="edit" size={13} />Edit</button>}
        {onMove && <button type="button" disabled={busy || index <= 0} onClick={() => run(() => onMove(-1))} title="Upar" aria-label={`Move this ${label} up`} className={ib}><Icon name="up" size={14} /></button>}
        {onMove && <button type="button" disabled={busy || index >= count - 1} onClick={() => run(() => onMove(1))} title="Neeche" aria-label={`Move this ${label} down`} className={ib}><Icon name="down" size={14} /></button>}
        {onRemove && <button type="button" disabled={busy} onClick={remove} title="Delete" aria-label={`Delete this ${label}`} className={`${ib} hover:!bg-ad-danger/10 hover:!text-ad-danger`}><Icon name="trash" size={13} /></button>}
      </div>
      {dialog}
    </div>
  );
}
