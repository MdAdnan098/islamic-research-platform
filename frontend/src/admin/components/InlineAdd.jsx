import { useEffect, useRef, useState } from "react";
import { BLOCK_META, newBlock, uid } from "../../lib/blocks.js";
import { Icon } from "../../components/ui/icons.jsx";
import { Fields, MENU_GROUPS } from "./BlockEditor.jsx";
import { IconBtn, ToastProvider, moveItem } from "./ui.jsx";

/** Is this item filled in enough to be added? Returns an error message, or "" when fine. */
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
const readBackup = (key) => {
  try {
    const v = key && localStorage.getItem(key);
    if (!v) return null;
    const p = JSON.parse(v);
    if (Array.isArray(p)) return { grouped: false, items: p };
    if (p && Array.isArray(p.items)) return { grouped: !!p.grouped, gid: p.grouped ? p.gid || uid() : undefined, items: p.items };
    return p && typeof p === "object" ? { grouped: false, items: [p] } : null; // older backups held one single item
  } catch { return null; }
};
const writeBackup = (key, v) => { try { if (key) { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v)); } } catch { /* ignore */ } };

function TypeMenu({ onPick, withBlock = false }) {
  return (
    <div className="space-y-2 rounded-xl border border-rule bg-card p-2 text-ink shadow-soft">
      {withBlock && (
        <div>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm font-semibold hover:bg-rule/40" onClick={() => onPick("group")}>
            <span className="w-4 shrink-0 text-center text-mute">{BLOCK_META.group.icon}</span>{BLOCK_META.group.label}
            <span className="text-xs font-normal text-mute">— andar kai cheezein jod sakte hain</span>
          </button>
        </div>
      )}
      {MENU_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-mute">{g.title}</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {g.types.map((t) => (
              <button key={t} type="button" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm hover:bg-rule/40" onClick={() => onPick(t)}>
                <span className="w-4 shrink-0 text-center text-mute">{BLOCK_META[t].icon}</span>{BLOCK_META[t].label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ONE new block: a clearly framed box that stays open while the admin adds things INSIDE it
 * (heading, paragraph, quote, reference, image ...), as many as needed. Save puts them into the post one after another.
 */
function BlockFrame({ initial, onInsert, onDone, onCancel, backupKey, restored }) {
  const grouped = !!initial.grouped;
  const gid = initial.gid;
  const [items, setItems] = useState(initial.items);
  const [menu, setMenu] = useState(initial.items.length === 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);
  const progress = useRef({ inserted: 0, last: null, marker: false }); // what is already in the post if a save stops half way
  useEffect(() => { if (backupKey) writeBackup(backupKey, items.length || grouped ? { grouped, gid, items } : null); }, [items, backupKey, grouped, gid]);
  // Bring the new block into view so it is obvious where it landed.
  useEffect(() => { box.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, []);

  const patch = (i, p) => { setErr(""); setItems((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x))); };
  const add = (type) => { setErr(""); setItems((l) => [...l, newBlock(type)]); setMenu(false); };

  async function save() {
    if (!items.length) return setErr("Pehle block ke andar kuch jodein.");
    for (let i = 0; i < items.length; i++) {
      const msg = problem(items[i]);
      if (msg) return setErr(`${i + 1}. ${BLOCK_META[items[i].type]?.label}: ${msg}`);
    }
    setBusy(true);
    let savedNow = 0;
    try {
      // A Block is saved as its marker first, then every item right after it carrying gid = the marker's id (see lib/groups.js).
      const seq = [];
      if (grouped && !progress.current.marker) seq.push({ id: gid, type: "group" });
      items.forEach((it) => seq.push(grouped ? { ...it, gid } : it));
      for (const it of seq) {
        await onInsert(it, progress.current.last, progress.current.inserted);
        progress.current = { inserted: progress.current.inserted + 1, last: it.id, marker: progress.current.marker || it.type === "group" };
        if (it.type !== "group") savedNow += 1;
      }
      onDone();
    } catch (e) {
      if (savedNow) setItems((l) => l.slice(savedNow)); // what is already saved is not added twice on retry
      setErr(e?.message || "Save nahi ho paya.");
      setBusy(false);
    }
  }

  return (
    <ToastProvider>
      <div ref={box} dir="ltr" className="my-4 space-y-3 rounded-xl border border-dashed border-accent/60 border-s-4 border-s-accent bg-card p-3.5 font-sans text-base text-ink shadow-soft">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-on-accent">{grouped ? "Block" : "Naya block"}</span>
          {restored && <span className="rounded-full bg-rule/50 px-2 py-0.5 text-mute">pichla adhura likha hua wapas aaya</span>}
        </div>
        <p className="-mt-1 text-xs text-mute">{grouped ? "Is Block ke andar heading, paragraph, quote, reference, image ya scan jitni chahiye jodein, phir Save dabayein." : "Ye ek naya block hai. Iske andar heading, paragraph, reference ya image jitni chahiye jodein, phir Save dabayein."}</p>

        {items.length === 0 && !menu && (
          <p className="rounded-lg border border-dashed border-rule px-3 py-4 text-center text-sm text-mute">Block abhi khali hai. Neeche "Add" se pehli cheez jodein.</p>
        )}

        {items.map((it, i) => (
          <section key={it.id} className="rounded-lg border border-rule bg-paper">
            <header className="flex items-center justify-between border-b border-rule px-3 py-1">
              <span className="flex items-center gap-2 text-xs font-medium text-mute"><span className="w-4 text-center">{BLOCK_META[it.type]?.icon}</span>{BLOCK_META[it.type]?.label}<span className="text-mute/60">#{i + 1}</span></span>
              <div className="flex">
                <IconBtn icon="up" label="Move up" disabled={busy || i === 0} onClick={() => setItems((l) => moveItem(l, i, i - 1))} />
                <IconBtn icon="down" label="Move down" disabled={busy || i === items.length - 1} onClick={() => setItems((l) => moveItem(l, i, i + 1))} />
                <IconBtn icon="trash" label="Remove from this block" danger disabled={busy} onClick={() => setItems((l) => l.filter((_, j) => j !== i))} />
              </div>
            </header>
            <div className="p-3"><Fields block={it} set={(p) => patch(i, p)} /></div>
          </section>
        ))}

        <div>
          <button type="button" aria-expanded={menu} disabled={busy} onClick={() => setMenu((m) => !m)} className="inline-flex items-center gap-1 rounded-full border border-rule bg-card px-3 py-1 text-xs font-semibold text-mute transition hover:border-accent/60 hover:text-ink">
            <Icon name="plus" size={13} />Add
          </button>
          {menu && <div className="mt-2"><TypeMenu onPick={add} /></div>}
        </div>

        {err && <p role="alert" className="text-sm text-ad-danger">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="a-btn-primary" disabled={busy || items.length === 0} onClick={save}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="a-btn" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </ToastProvider>
  );
}

/**
 * Admin-only: a small "+ Add" button shown under a block of the post. It opens a NEW BLOCK right there; the admin then
 * adds heading / paragraph / reference / image ... inside that block, and Save puts them straight into the post,
 * so the admin never has to go back to the dashboard.
 * onInsert(block, afterId, offset): afterId = the item saved just before (null for the first one), offset = how many were saved before.
 */
export default function InlineAdd({ onInsert, backupKey, tools = null }) {
  const [restored] = useState(() => readBackup(backupKey));
  const [draft, setDraft] = useState(restored);
  const [menu, setMenu] = useState(false);
  const closeDraft = () => { writeBackup(backupKey, null); setDraft(null); };
  // "Block" starts an empty Block (numbered like every other block); any other type opens one new item to fill in.
  const pick = (type) => {
    setMenu(false);
    setDraft(type === "group" ? { grouped: true, gid: uid(), items: [] } : { grouped: false, items: [newBlock(type)] });
  };

  if (draft) {
    return <BlockFrame initial={draft} backupKey={backupKey} restored={!!restored && draft === restored} onCancel={closeDraft} onInsert={onInsert} onDone={closeDraft} />;
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
      {menu && <div className="mt-2 opacity-100"><TypeMenu withBlock onPick={pick} /></div>}
    </div>
  );
}
