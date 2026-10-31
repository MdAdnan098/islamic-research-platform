import { useState } from "react";
import { useConfirm } from "./ui.jsx";

/**
 * Admin-only: sits in the small admin panel of the post page. Edits are auto-saved as a draft; this button
 * makes the draft the live post. Loaded on demand, so public visitors never download it.
 */
export default function PublishBar({ draft }) {
  const [msg, setMsg] = useState("");
  const [confirm, dialog] = useConfirm();
  if (!draft.ready) return null;

  async function publish() {
    setMsg("");
    try { await draft.publish(); setMsg("Publish ho gaya ✓"); setTimeout(() => setMsg(""), 4000); }
    catch (e) { setMsg(e?.message || "Publish nahi ho paya."); }
  }
  async function discard() {
    if (!(await confirm({ title: "Draft hatayein?", message: "Publish nahi kiye hue saare badlav hat jayenge; post pehle jaisi live rahegi.", confirm: "Yes, hatao", danger: true }))) return;
    setMsg("");
    try { await draft.discard(); } catch (e) { setMsg(e?.message || "Nahi ho paya."); }
  }

  const pending = draft.needsPublish;
  return (
    <div className="mt-1 space-y-1 border-t border-rule pt-1.5">
      <p className="text-mute">{draft.busy ? "Saving…" : pending ? (draft.status === "published" ? "Draft saved · live post abhi purani hai" : "Draft saved · post abhi publish nahi hui") : "Sab kuch published hai"}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={draft.busy || !pending} onClick={publish} className="a-btn-primary btn-cta !px-3 !py-1.5 !text-xs disabled:opacity-40">Save &amp; Publish</button>
        {draft.hasDraft && <button type="button" disabled={draft.busy} onClick={discard} className="a-btn !px-3 !py-1.5 !text-xs">Draft hatao</button>}
      </div>
      {msg && <p role="status" className="text-mute">{msg}</p>}
      {dialog}
    </div>
  );
}
