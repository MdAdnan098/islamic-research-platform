import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { slugify } from "../../lib/format.js";
import { Empty, ErrorBox, Field, IconBtn, Modal, PageHeader, Spinner, StatusBadge, moveItem, toOrdering, useConfirm, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

function CategoryForm({ initial, count, onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", slug: "", description: "", type: "aqeedah", status: "active", ...initial });
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const body = { name: f.name.trim(), slug: f.slug, description: f.description?.trim() || null, type: f.type, status: f.status };
    try {
      initial ? await adminApi.categories.update(initial.id, body) : await adminApi.categories.create({ ...body, ordering: count });
      toast("Category saved"); onDone();
    } catch (err) { toast(err.message, "error"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name *"><input className="a-input" dir="auto" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: touched ? f.slug : slugify(e.target.value) })} /></Field>
      <Field label="Slug *" hint="lowercase-with-hyphens"><input className="a-input" required value={f.slug} onChange={(e) => { setTouched(true); setF({ ...f, slug: e.target.value }); }} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Section"><select className="a-input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="aqeedah">Aqaid</option><option value="masail">Masail</option></select></Field>
        <Field label="Status"><select className="a-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="archived">Archived</option></select></Field>
      </div>
      <Field label="Description"><textarea className="a-input min-h-20" dir="auto" value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="a-btn" onClick={onCancel}>Cancel</button><button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export default function Categories() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [editing, setEditing] = useState(null); // null | "new" | category
  const { data, error, loading, reload, setData } = useAsync(async (s) => (await adminApi.categories.list({}, s)).sort((a, b) => a.ordering - b.ordering), []);

  async function move(i, to) {
    const next = moveItem(data, i, to);
    setData(next);
    try { await adminApi.categories.reorder(toOrdering(next)); } catch (e) { toast(e.message, "error"); reload(); }
  }
  async function archive(c) {
    if (!(await confirm({ title: "Archive category", message: `“${c.name}” will be hidden from the public site. Its topics and articles stay in the database.`, confirm: "Archive", danger: true }))) return;
    try { await adminApi.categories.archive(c.id); toast("Archived"); reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="Categories" desc="Top-level groups inside Aqaid and Masail.">
        <button className="a-btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />New category</button>
      </PageHeader>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>No categories yet.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((c, i) => (
            <li key={c.id} className="flex min-h-[60px] flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="flex"><IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} /><IconBtn icon="down" label="Move down" disabled={i === data.length - 1} onClick={() => move(i, i + 1)} /></div>
              <div className="min-w-0 flex-1"><p dir="auto" className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-ad-mute">{c.type === "aqeedah" ? "Aqaid" : "Masail"} · /{c.slug}</p></div>
              <StatusBadge status={c.status} />
              <IconBtn icon="edit" label="Edit" onClick={() => setEditing(c)} />
              {c.status !== "archived" && <IconBtn icon="trash" label="Archive" danger onClick={() => archive(c)} />}
            </li>
          ))}
        </ul>
      )}
      {editing && <Modal title={editing === "new" ? "New category" : "Edit category"} onClose={() => setEditing(null)}><CategoryForm initial={editing === "new" ? null : editing} count={data?.length || 0} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /></Modal>}
      {dialog}
    </>
  );
}
