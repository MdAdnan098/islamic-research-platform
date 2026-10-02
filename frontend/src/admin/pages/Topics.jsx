import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { slugify } from "../../lib/format.js";
import { Empty, ErrorBox, Field, IconBtn, Modal, PageHeader, Spinner, StatusBadge, moveItem, toOrdering, useConfirm, useToast } from "../components/ui.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { Icon } from "../../components/ui/icons.jsx";

function TopicForm({ initial, categoryId, count, onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", slug: "", intro: "", coverKey: "", status: "active", ...initial });
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const body = { title: f.title.trim(), slug: f.slug, intro: f.intro?.trim() || null, coverKey: f.coverKey || null, status: f.status };
    try {
      initial ? await adminApi.topics.update(initial.id, body) : await adminApi.topics.create({ ...body, categoryId, ordering: count });
      toast("Topic saved"); onDone();
    } catch (err) { toast(err.message, "error"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title *"><input className="a-input" dir="auto" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: touched ? f.slug : slugify(e.target.value) })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slug *"><input className="a-input" required value={f.slug} onChange={(e) => { setTouched(true); setF({ ...f, slug: e.target.value }); }} /></Field>
        <Field label="Status"><select className="a-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="archived">Archived</option></select></Field>
      </div>
      <Field label="Short introduction"><textarea className="a-input min-h-28" dir="auto" value={f.intro || ""} onChange={(e) => setF({ ...f, intro: e.target.value })} /></Field>
      <div><span className="a-label">Cover image</span><MediaUploader value={f.coverKey} onChange={(coverKey) => setF({ ...f, coverKey })} label="Upload cover" /></div>
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="a-btn" onClick={onCancel}>Cancel</button><button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export default function Topics() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [catId, setCatId] = useState("");
  const [editing, setEditing] = useState(null);
  const cats = useAsync((s) => adminApi.categories.list({}, s), []);
  const activeCat = catId || cats.data?.[0]?.id || "";
  const { data, error, loading, reload, setData } = useAsync(async (s) => (activeCat ? (await adminApi.topics.list({ categoryId: activeCat }, s)).sort((a, b) => a.ordering - b.ordering) : []), [activeCat]);

  async function move(i, to) {
    const next = moveItem(data, i, to); setData(next);
    try { await adminApi.topics.reorder(toOrdering(next)); } catch (e) { toast(e.message, "error"); reload(); }
  }
  async function archive(t) {
    if (!(await confirm({ title: "Archive topic", message: `“${t.title}” will be hidden from the public site.`, confirm: "Archive", danger: true }))) return;
    try { await adminApi.topics.archive(t.id); toast("Archived"); reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="Topics" desc="Topics live inside a category.">
        <select className="a-input !w-auto" value={activeCat} onChange={(e) => setCatId(e.target.value)} aria-label="Category">
          {(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === "aqeedah" ? "Aqaid" : "Masail"})</option>)}
        </select>
        <button className="a-btn-primary" disabled={!activeCat} onClick={() => setEditing("new")}><Icon name="plus" size={15} />New topic</button>
      </PageHeader>
      {cats.loading && !cats.data ? <Spinner /> : !cats.data?.length ? <Empty>Create a category first.</Empty> : loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>No topics in this category.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((t, i) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="flex"><IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} /><IconBtn icon="down" label="Move down" disabled={i === data.length - 1} onClick={() => move(i, i + 1)} /></div>
              <div className="min-w-0 flex-1"><p dir="auto" className="truncate text-sm font-medium">{t.title}</p><p className="text-xs text-ad-mute">/{t.slug}</p></div>
              <StatusBadge status={t.status} />
              <IconBtn icon="edit" label="Edit" onClick={() => setEditing(t)} />
              {t.status !== "archived" && <IconBtn icon="trash" label="Archive" danger onClick={() => archive(t)} />}
            </li>
          ))}
        </ul>
      )}
      {editing && <Modal wide title={editing === "new" ? "New topic" : "Edit topic"} onClose={() => setEditing(null)}><TopicForm initial={editing === "new" ? null : editing} categoryId={activeCat} count={data?.length || 0} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /></Modal>}
      {dialog}
    </>
  );
}
