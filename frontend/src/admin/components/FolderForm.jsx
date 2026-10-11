import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { isSlug, slugify } from "../../lib/format.js";
import { flattenTree, folderLabel, subtreeIds } from "../../lib/folders.js";
import { Field, useToast } from "./ui.jsx";
import { MediaUploader } from "./MediaUploader.jsx";

const sectionName = (c) => `${c.name} (${c.type === "aqeedah" ? "Aqaid" : "Masail"})`;

/**
 * Create / edit a folder. Used by the Topics page and by the article editor's "+ Add Folder" modal.
 * Section/category, optional parent folder (empty = root folder), name. Editing never changes the category.
 */
export function FolderForm({ initial, categories, defaultCategoryId, defaultParentId = "", onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", slug: "", intro: "", coverKey: "", categoryId: defaultCategoryId || categories[0]?.id || "", parentId: defaultParentId || "", ...initial, parentId: initial ? initial.parentId || "" : defaultParentId || "" });
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const topics = useAsync((s) => (f.categoryId ? adminApi.topics.list({ categoryId: f.categoryId }, s) : []), [f.categoryId]);
  const tree = flattenTree(topics.data || []);
  const blocked = initial ? subtreeIds(topics.data || [], initial.id) : new Set();
  const parents = tree.filter((t) => !blocked.has(t.id));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const title = f.title.trim();
    if (!title) return toast("Folder ka naam likhein", "error");
    if (!f.categoryId) return toast("Section / category chuniye", "error");
    let slug = isSlug(f.slug) ? f.slug : slugify(f.slug || title);
    if (!isSlug(slug)) slug = `folder-${Math.random().toString(36).slice(2, 8)}`;
    const body = { title, slug, intro: f.intro?.trim() || null, coverKey: f.coverKey || null, parentId: f.parentId || null, ...(initial?.status === "archived" ? { status: "active" } : {}) }; // editing an old archived folder brings it back
    setBusy(true);
    try {
      const saved = initial
        ? await adminApi.topics.update(initial.id, body)
        : await adminApi.topics.create({ ...body, categoryId: f.categoryId, ordering: (topics.data || []).filter((t) => (t.parentId || "") === (f.parentId || "")).length });
      toast("Folder save ho gaya");
      onDone(saved);
    } catch (err) { toast(err.message, "error"); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Section / Category *">
        <select className="a-input" value={f.categoryId} disabled={!!initial} onChange={(e) => setF({ ...f, categoryId: e.target.value, parentId: "" })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{sectionName(c)}</option>)}
        </select>
      </Field>
      <Field label="Parent folder" hint="Khali chhodein to ye root folder banega; chunne par subfolder.">
        <select className="a-input" dir="auto" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} disabled={topics.loading && !topics.data}>
          <option value="">— Koi nahi (root folder) —</option>
          {parents.map((t) => <option key={t.id} value={t.id}>{folderLabel(t)}</option>)}
        </select>
      </Field>
      <Field label="Folder name *"><input className="a-input" dir="auto" required maxLength={300} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: touched ? f.slug : slugify(e.target.value) })} /></Field>
      <Field label="Link name (slug)"><input className="a-input" value={f.slug} onChange={(e) => { setTouched(true); setF({ ...f, slug: e.target.value }); }} placeholder="auto" /></Field>
      <Field label="Short introduction"><textarea className="a-input min-h-24" dir="auto" value={f.intro || ""} onChange={(e) => setF({ ...f, intro: e.target.value })} /></Field>
      <div><span className="a-label">Cover image</span><MediaUploader value={f.coverKey} onChange={(coverKey) => setF({ ...f, coverKey })} label="Upload cover" /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="a-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
