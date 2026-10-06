import { useState } from "react";
import { BLOCK_META, newBlock } from "../../lib/blocks.js";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { Icon } from "../../components/ui/icons.jsx";
import { Field, IconBtn, Modal, moveItem } from "./ui.jsx";
import { MediaUploader } from "./MediaUploader.jsx";
import { ReferenceForm } from "./ReferenceForm.jsx";

const T = ({ value, onChange, rows = 5, ...p }) => (
  <textarea className="a-input" dir="auto" rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} {...p} />
);
const I = ({ value, onChange, ...p }) => <input className="a-input" dir="auto" value={value || ""} onChange={(e) => onChange(e.target.value)} {...p} />;

function ReferenceField({ block, set }) {
  const { data, reload, setData } = useAsync((s) => adminApi.references.list({ limit: 100 }, s), []);
  const [creating, setCreating] = useState(false);
  const list = data || [];
  return (
    <>
      <Field label="Reference">
        <div className="flex gap-2">
          <select className="a-input" value={block.referenceId || ""} onChange={(e) => set({ referenceId: e.target.value })}>
            <option value="">— choose a reference —</option>
            {list.map((r) => <option key={r.id} value={r.id}>{r.book}{r.volume ? ` · v${r.volume}` : ""}{r.page ? ` · p${r.page}` : ""}</option>)}
          </select>
          <button type="button" className="a-btn shrink-0" onClick={() => setCreating(true)}><Icon name="plus" size={15} />New</button>
        </div>
      </Field>
      {creating && (
        <Modal title="New reference" wide onClose={() => setCreating(false)}>
          <ReferenceForm onCancel={() => setCreating(false)} onSaved={(r) => { setData((l) => [r, ...(l || [])]); set({ referenceId: r.id }); setCreating(false); reload(); }} />
        </Modal>
      )}
    </>
  );
}

function Fields({ block, set }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Heading text"><I value={block.text} onChange={(text) => set({ text })} /></Field>
          <Field label="Level">
            <select className="a-input" value={block.level || 2} onChange={(e) => set({ level: Number(e.target.value) })}><option value={2}>H2 (section)</option><option value={3}>H3 (sub)</option></select>
          </Field>
        </div>
      );
    case "text":
      return <Field label="Paragraphs" hint="Separate paragraphs with a blank line."><T rows={7} value={block.text} onChange={(text) => set({ text })} /></Field>;
    case "quote":
      return (
        <div className="space-y-3">
          <Field label="Kind">
            <select className="a-input" value={block.kind || "quote"} onChange={(e) => set({ kind: e.target.value })}><option value="quote">Quote</option><option value="ayat">Ayat (Quran)</option><option value="hadith">Hadith</option></select>
          </Field>
          <Field label="Text"><T rows={4} value={block.text} onChange={(text) => set({ text })} /></Field>
          <Field label="Source"><I value={block.source} onChange={(source) => set({ source })} placeholder="e.g. Surah Al-Hashr 59:7" /></Field>
        </div>
      );
    case "reference":
      return <ReferenceField block={block} set={set} />;
    case "image":
      return (
        <div className="space-y-3">
          <MediaUploader value={block.key} onChange={(key) => set({ key })} label="Upload image" />
          <Field label="Caption"><I value={block.caption} onChange={(caption) => set({ caption })} /></Field>
          <Field label="Alt text"><I value={block.alt} onChange={(alt) => set({ alt })} /></Field>
        </div>
      );
    case "scan": {
      const pages = block.pages || [];
      const upd = (pages) => set({ pages });
      return (
        <div className="space-y-3">
          {pages.map((p, i) => (
            <div key={i} className="flex flex-wrap items-start gap-3 rounded-md border border-ad-rule p-3">
              <span className="pt-2 text-xs text-ad-mute">#{i + 1}</span>
              <div className="min-w-[200px] flex-1 space-y-2">
                <MediaUploader compact value={p.key} onChange={(key) => upd(pages.map((x, j) => (j === i ? { ...x, key } : x)))} label="Upload page" />
                <I value={p.caption} placeholder="Page caption (optional)" onChange={(caption) => upd(pages.map((x, j) => (j === i ? { ...x, caption } : x)))} />
              </div>
              <div className="flex">
                <IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => upd(moveItem(pages, i, i - 1))} />
                <IconBtn icon="down" label="Move down" disabled={i === pages.length - 1} onClick={() => upd(moveItem(pages, i, i + 1))} />
                <IconBtn icon="trash" label="Remove page" danger onClick={() => upd(pages.filter((_, j) => j !== i))} />
              </div>
            </div>
          ))}
          <button type="button" className="a-btn" onClick={() => upd([...pages, { key: "", caption: "" }])}><Icon name="plus" size={15} />Add page</button>
          <Field label="Overall caption"><I value={block.caption} onChange={(caption) => set({ caption })} /></Field>
        </div>
      );
    }
    case "pdf":
      return (
        <div className="space-y-3">
          <MediaUploader value={block.key} accept="application/pdf" onChange={(key) => set({ key })} label="Upload PDF" />
          <Field label="Title"><I value={block.title} onChange={(title) => set({ title })} /></Field>
        </div>
      );
    default:
      return <p className="text-sm text-ad-mute">A decorative divider — nothing to edit.</p>;
  }
}

/** How the add-block menu is grouped (internal block types are unchanged). */
const MENU_GROUPS = [
  { title: "Text", types: ["heading", "text", "quote", "divider"] },
  { title: "Reference", types: ["reference"] },
  { title: "Media", types: ["image", "scan", "pdf"] },
];

function AddMenu({ onAdd, label = "Add block" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" className="a-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon name="plus" size={15} />{label}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-ad-rule bg-ad-card p-1.5 shadow-lg">
            {MENU_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ad-mute">{g.title}</p>
                <div className="grid grid-cols-2 gap-1">
                  {g.types.map((t) => (
                    <button key={t} type="button" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm hover:bg-ad-bg" onClick={() => { onAdd(t); setOpen(false); }}>
                      <span className="w-4 shrink-0 text-center text-ad-mute">{BLOCK_META[t].icon}</span>{BLOCK_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BlockEditor({ blocks, onChange }) {
  const patch = (i, p) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const insert = (at, type) => onChange([...blocks.slice(0, at), newBlock(type), ...blocks.slice(at)]);

  return (
    <div className="space-y-3">
      {blocks.length === 0 && <div className="a-card border-dashed p-8 text-center text-sm text-ad-mute">No blocks yet — add the first one below.</div>}
      {blocks.map((b, i) => (
        <section key={b.id} className="a-card">
          <header className="flex items-center justify-between border-b border-ad-rule px-3 py-1.5">
            <span className="flex items-center gap-2 text-xs font-medium text-ad-mute"><span className="w-4 text-center">{BLOCK_META[b.type]?.icon}</span>{BLOCK_META[b.type]?.label} <span className="text-ad-mute/60">#{i + 1}</span></span>
            <div className="flex">
              <IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => onChange(moveItem(blocks, i, i - 1))} />
              <IconBtn icon="down" label="Move down" disabled={i === blocks.length - 1} onClick={() => onChange(moveItem(blocks, i, i + 1))} />
              <IconBtn icon="trash" label="Delete block" danger onClick={() => onChange(blocks.filter((_, j) => j !== i))} />
            </div>
          </header>
          <div className="p-3.5"><Fields block={b} set={(p) => patch(i, p)} /></div>
          <footer className="border-t border-ad-rule px-3 py-1.5"><AddMenu label="Insert below" onAdd={(t) => insert(i + 1, t)} /></footer>
        </section>
      ))}
      {blocks.length === 0 && <AddMenu onAdd={(t) => insert(0, t)} />}
    </div>
  );
}
