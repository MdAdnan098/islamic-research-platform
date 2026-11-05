import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/icons.jsx";
import { uid } from "../../lib/blocks.js";
import { addEmptyBlock, groupsOf, isGroup, moveIntoBlock, removeBlock, restoreStructure } from "../../lib/groups.js";
import { useConfirm, useToast } from "./ui.jsx";

/**
 * Admin "Select & Move": tick already-written blocks of a post (one by one, or a whole stretch with Range) and move them
 * into a Block. Used by the live page composer and by the dashboard editor's preview.
 *
 *   const sel = useBlockSelect(blocks);            // selection state (checkboxes on the page)
 *   <ArticleView select={sel.on ? sel : undefined} />
 *   <MoveBar sel={sel} blocks={blocks} apply={(mutate) => ...} />   // apply(mutate): stores mutate(currentBlocks)
 */
export function useBlockSelect(blocks) {
  const [on, setOn] = useState(false);
  const [ids, setIds] = useState(() => new Set());
  const [range, setRange] = useState(false);
  const [pendingDelete, askDelete] = useState(null); // a Block whose "Block hatao" was tapped on the page (MoveBar asks and deletes)
  const anchor = useRef(null);
  const live = useRef(blocks);
  live.current = blocks;

  const toggle = (id) => {
    const from = anchor.current; // read now: the updater below runs later
    anchor.current = id;
    setIds((cur) => {
      const next = new Set(cur);
      const list = live.current;
      if (range && from && from !== id) {
        const a = list.findIndex((b) => b.id === from);
        const z = list.findIndex((b) => b.id === id);
        if (a >= 0 && z >= 0) {
          for (let i = Math.min(a, z); i <= Math.max(a, z); i += 1) if (!isGroup(list[i]) && list[i].id) next.add(list[i].id);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clear = () => { setIds(new Set()); anchor.current = null; };
  const turn = (v) => { setOn(v); if (!v) { clear(); setRange(false); } };
  return { on, ids, range, setRange, toggle, clear, setOn: turn, pendingDelete, askDelete };
}

const pill = "inline-flex items-center gap-1 rounded-full border border-rule bg-card px-2.5 py-1 text-xs font-semibold text-mute transition hover:border-accent/60 hover:text-ink disabled:opacity-40";

export default function MoveBar({ sel, blocks, apply }) {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [target, setTarget] = useState("new"); // "new" or the id of an existing Block
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState(null); // { before, afterIds, n } of the last move

  const groups = groupsOf(blocks);
  const chosen = target === "new" ? null : groups.find((g) => g.id === target) || null;
  const count = [...sel.ids].filter((id) => blocks.some((b) => b.id === id && !isGroup(b))).length;

  async function go() {
    const pick = chosen ? { gid: chosen.id } : { create: true, id: uid() };
    let dry;
    try { dry = moveIntoBlock(blocks, [...sel.ids], pick); } catch (e) { toast(e.message, "error"); return; }
    const where = chosen ? `Block #${chosen.n} ke andar (sabse neeche)` : "ek naya Block banakar uske andar";
    const ok = await confirm({
      title: "Block mein move karein?",
      message: `${dry.moved} hissa ${where} chala jayega. Unka order, baaki zabaanon ka text, highlight, alignment aur reference sab waisa hi rahega. Move ke baad Undo ka button milega.`,
      confirm: "Yes, move karo",
    });
    if (!ok) return;
    setBusy(true);
    try {
      let snap = null;
      let after = null;
      await apply((cur) => { // `cur` is the freshest copy of the post: the move is worked out on it again
        snap = cur;
        after = moveIntoBlock(cur, [...sel.ids], pick).blocks;
        return after;
      });
      setUndo({ before: snap, afterIds: new Set(after.map((b) => b.id)), text: `${dry.moved} hissa move hua` });
      sel.clear();
      setTarget("new");
      toast(`${dry.moved} hissa Block mein chala gaya`);
    } catch (e) { toast(e?.message || "Move nahi ho paya.", "error"); } finally { setBusy(false); }
  }

  /** One undo-able change of the block list: `change(cur)` returns the new blocks. */
  async function change(change, doneText, n) {
    setBusy(true);
    try {
      let snap = null;
      let after = null;
      await apply((cur) => { snap = cur; after = change(cur); return after; });
      setUndo({ before: snap, afterIds: new Set(after.map((b) => b.id)), text: n });
      toast(doneText);
      return true;
    } catch (e) { toast(e?.message || "Nahi ho paya.", "error"); return false; } finally { setBusy(false); }
  }

  // A new EMPTY Block (at the end of the post): items are then moved or added into it.
  async function createBlock() {
    const id = uid();
    const ok = await change((cur) => addEmptyBlock(cur, id), "Naya Block ban gaya", "Naya Block bana");
    if (ok) setTarget(id);
  }

  // Deletes ONLY the Block: its content stays in the post as normal blocks.
  async function deleteBlock(gid) {
    const g = groupsOf(blocks).find((x) => x.id === gid);
    if (!g) return;
    const yes = await confirm({
      title: `Block #${g.n} hatayein?`,
      message: g.size ? `Sirf ye Block hatega. Iske andar ke ${g.size} hisse post mein waise hi rahenge (text, baaki zabaanon ka text, highlight sab wahi), bas Block ke bina. Undo ka button milega.` : "Ye Block khali hai, hata diya jayega.",
      confirm: "Yes, Block hatao",
    });
    if (!yes) return;
    const ok = await change((cur) => { const r = removeBlock(cur, gid); if (!r) throw new Error("Ye Block post mein nahi mila. Page refresh karke dobara koshish karein."); return r; }, "Block hat gaya, content post mein hai", `Block #${g.n} hata`);
    if (ok && target === gid) setTarget("new");
  }

  // "Block hatao" on a Block's label (page) -> same flow
  useEffect(() => {
    if (!sel.pendingDelete) return;
    const id = sel.pendingDelete;
    sel.askDelete(null);
    deleteBlock(id);
  }, [sel.pendingDelete]); // eslint-disable-line react-hooks/exhaustive-deps

  async function back() {
    if (!undo) return;
    const same = blocks.length === undo.afterIds.size && blocks.every((b) => undo.afterIds.has(b.id));
    if (!same) { setUndo(null); toast("Move ke baad post mein aur blocks badle hain, isliye Undo nahi ho sakta.", "error"); return; }
    setBusy(true);
    try {
      await apply((cur) => restoreStructure(undo.before, cur)); // order / Blocks come back; any text edited since stays
      setUndo(null);
      toast("Move undo ho gaya");
    } catch (e) { toast(e?.message || "Undo nahi ho paya.", "error"); } finally { setBusy(false); }
  }

  if (!sel.on && !undo) return dialog;
  return (
    <>
      <div dir="ltr" className="fixed bottom-14 right-3 z-[85] w-fit max-w-[calc(100vw-1.5rem)] space-y-2 rounded-xl border border-rule bg-paper/95 p-2.5 font-sans text-xs text-ink shadow-elev backdrop-blur">
        {sel.on && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">{count} select</span>
              <button type="button" aria-pressed={sel.range} onClick={() => sel.setRange(!sel.range)} className={`${pill} ${sel.range ? "!border-accent !text-accent" : ""}`} title="ON ho to ek hissa tick karke dusra tick karein: beech ka sab select ho jayega">Range: {sel.range ? "ON" : "OFF"}</button>
              <button type="button" className={pill} disabled={!count} onClick={sel.clear}>Clear</button>
              <button type="button" className={`${pill} ms-auto`} onClick={() => sel.setOn(false)} aria-label="Select band karein"><Icon name="x" size={12} />Band</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={chosen ? chosen.id : "new"} onChange={(e) => setTarget(e.target.value)} className="min-w-0 max-w-[14rem] rounded-md border border-rule bg-card px-2 py-1 text-xs">
                <option value="new">Naya Block banao</option>
                {groups.map((g) => <option key={g.id} value={g.id}>Block #{g.n} ke andar ({g.size})</option>)}
              </select>
              <button type="button" className="a-btn-primary !px-3 !py-1" disabled={busy || !count} onClick={go}>{busy ? "Moving…" : "Move"}</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rule pt-2">
              <button type="button" className={pill} disabled={busy} onClick={createBlock} title="Post ke aakhir mein ek khali Block banta hai"><Icon name="plus" size={12} />Naya Block</button>
              <button type="button" className={`${pill} hover:!border-ad-danger/50 hover:!text-ad-danger`} disabled={busy || !chosen} onClick={() => chosen && deleteBlock(chosen.id)} title="Upar dropdown mein chuna hua Block hatayein (andar ka content rahega)"><Icon name="trash" size={12} />{chosen ? `Block #${chosen.n} hatao` : "Block hatao"}</button>
            </div>
            {!count && <p className="text-mute">Jo hissa move karna hai uske upar wale box ko tick karein.</p>}
          </>
        )}
        {undo && (
          <div className="flex items-center gap-2">
            <span className="text-mute">{undo.text}</span>
            <button type="button" className={pill} disabled={busy} onClick={back}>Undo</button>
            <button type="button" className="text-mute hover:text-ink" onClick={() => setUndo(null)} aria-label="Hatayein"><Icon name="x" size={12} /></button>
          </div>
        )}
      </div>
      {dialog}
    </>
  );
}
