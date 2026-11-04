import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate } from "../../lib/format.js";
import { cloneBlocks } from "../../lib/blocks.js";
import { Empty, ErrorBox, IconBtn, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const LIMIT = 20;
const LANGS = { ur: "اردو", en: "Roman", hi: "हिन्दी", ar: "العربية" };

export default function Articles() {
  const toast = useToast();
  const nav = useNavigate();
  const [confirm, dialog] = useConfirm();
  const [f, setF] = useState({ status: "", language: "", categoryId: "", q: "", page: 1 });
  const set = (p) => setF((s) => ({ ...s, page: 1, ...p }));
  // The search runs on the server (all articles, not just this page); it waits a moment after the last key.
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setQ(f.q.trim()); setF((s) => (s.page === 1 ? s : { ...s, page: 1 })); }, 350);
    return () => clearTimeout(t);
  }, [f.q]);
  const cats = useAsync((s) => adminApi.categories.list({}, s), []);
  const { data, error, loading, reload } = useAsync(
    (s) => adminApi.articles.listPage({ status: f.status, language: f.language, categoryId: f.categoryId, q, page: f.page, limit: LIMIT }, s),
    [f.status, f.language, f.categoryId, q, f.page]
  );
  // Bulk select: ids ticked on THIS page (cleared whenever the list changes: filter, search or page).
  const [picked, setPicked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => { setPicked(new Set()); }, [f.status, f.language, f.categoryId, q, f.page]);
  const catName = (id) => cats.data?.find((c) => c.id === id)?.name || "—";
  const rows = data?.articles || [];
  const toggle = (id) => setPicked((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPicked = rows.length > 0 && rows.every((a) => picked.has(a.id));
  const pickedRows = rows.filter((a) => picked.has(a.id));
  const pages = data?.pages || 1;
  // e.g. the last article of the last page was deleted: step back to the last page that still exists
  useEffect(() => { if (data && f.page > pages) setF((s) => ({ ...s, page: pages })); }, [data, pages, f.page]);

  async function act(a, name) {
    if (name === "unpublish" && !(await confirm({ title: "Unpublish karein?", message: `“${a.title}” site se hat jayegi aur draft ban jayegi. Baad mein dobara publish kar sakte hain.`, confirm: "Unpublish" }))) return;
    try { await adminApi.articles.action(a.id, name); toast(`Article ${name === "archive" ? "archived" : name + "ed"}`); reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function remove(a) {
    if (!(await confirm({ title: "Article delete karein?", message: `“${a.title}” hamesha ke liye delete ho jayega. Ye wapas nahi aa sakta.`, confirm: "Delete", danger: true }))) return;
    try { await adminApi.articles.remove(a.id); toast("Article delete ho gaya"); reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function removeAll() {
    if (!(await confirm({ title: "Saare articles delete karein?", message: "Saare drafts aur published articles hamesha ke liye delete ho jayenge. Ye wapas nahi aa sakta.", confirm: "Aage badhein", danger: true }))) return;
    if (window.prompt("Pakka karne ke liye DELETE likhein") !== "DELETE") return toast("Delete nahi hua (DELETE sahi nahi likha)", "error");
    try { const r = await adminApi.articles.removeAll(); toast(`${r.deleted} articles delete ho gaye`); reload(); } catch (e) { toast(e.message, "error"); }
  }
  // Bulk: runs the same single-article calls one after another and reports how many worked.
  async function bulk(kind) {
    const targets = pickedRows.filter((a) => (kind === "publish" ? a.status !== "published" : kind === "unpublish" ? a.status === "published" : true));
    if (!targets.length) return toast(kind === "publish" ? "Chuni hui posts mein koi publish hone layak nahi hai." : "Chuni hui posts mein koi published post nahi hai.", "error");
    const skipped = pickedRows.length - targets.length;
    const note = skipped ? ` (${skipped} post par asar nahi hoga)` : "";
    const ask = {
      publish: { title: `${targets.length} posts publish karein?`, message: `Ye posts site par live ho jayengi${note}.`, confirm: "Publish" },
      unpublish: { title: `${targets.length} posts unpublish karein?`, message: `Ye posts site se hat kar draft ban jayengi${note}.`, confirm: "Unpublish" },
      delete: { title: `${targets.length} posts delete karein?`, message: "Ye hamesha ke liye delete ho jayengi. Ye wapas nahi aa sakta.", confirm: "Delete", danger: true },
    }[kind];
    if (!(await confirm(ask))) return;
    setBulkBusy(true);
    let ok = 0; let firstError = "";
    for (const a of targets) {
      try { kind === "delete" ? await adminApi.articles.remove(a.id) : await adminApi.articles.action(a.id, kind); ok += 1; } catch (e) { if (!firstError) firstError = `“${a.title}”: ${e.message}`; }
    }
    setBulkBusy(false);
    setPicked(new Set());
    const failed = targets.length - ok;
    toast(failed ? `${ok} ho gayi, ${failed} nahi hui — ${firstError}` : `${ok} posts ${kind === "publish" ? "publish" : kind === "unpublish" ? "unpublish" : "delete"} ho gayi`, failed ? "error" : undefined);
    reload();
  }
  async function duplicate(a) {
    try {
      const copy = await adminApi.articles.create({
        categoryId: a.categoryId, topicId: a.topicId, title: `${a.title} (copy)`, slug: `${a.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
        language: a.language, blocks: cloneBlocks(a.blocks), references: a.references, excerpt: a.excerpt,
        seoTitle: a.seoTitle, seoDescription: a.seoDescription, coverKey: a.coverKey,
      });
      toast("Duplicated as draft"); nav(`/admin/articles/${copy.id}`);
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="Articles" desc="Research articles, in every language.">
        <Link to="/admin/articles/new" className="a-btn-primary btn-cta"><Icon name="plus" size={15} />New article</Link>
      </PageHeader>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="a-input" dir="auto" placeholder="Search title (saare articles mein)…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="a-input" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
        <select className="a-input" value={f.language} onChange={(e) => set({ language: e.target.value })}><option value="">All languages</option>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="a-input" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}><option value="">All categories</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      {pickedRows.length > 0 && (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-ad-rule bg-ad-bg/95 px-3 py-2 text-sm backdrop-blur" role="toolbar" aria-label="Bulk actions">
          <span className="font-semibold">{pickedRows.length} selected</span>
          <button className="a-btn-primary btn-cta !py-1" disabled={bulkBusy} onClick={() => bulk("publish")}>Publish</button>
          <button className="a-btn btn-cta !py-1" disabled={bulkBusy} onClick={() => bulk("unpublish")}>Unpublish</button>
          <button className="a-btn-danger !py-1" disabled={bulkBusy} onClick={() => bulk("delete")}><Icon name="trash" size={14} /> Delete</button>
          <button className="a-btn ms-auto !py-1" disabled={bulkBusy} onClick={() => setPicked(new Set())}>Clear</button>
          {bulkBusy && <span className="w-full text-xs text-ad-mute">Ho raha hai… thodi der ruko, page band mat karna.</span>}
        </div>
      )}
      {rows.length > 0 && (
        <label className="mb-2 flex w-fit items-center gap-2 text-xs text-ad-mute">
          <input type="checkbox" className="h-4 w-4" checked={allPicked} disabled={bulkBusy} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((a) => a.id)))} />
          Is page ke saare select karein
        </label>
      )}
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? <Empty>No articles found.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {rows.map((a) => (
            <li key={a.id} className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`Select ${a.title}`} checked={picked.has(a.id)} disabled={bulkBusy} onChange={() => toggle(a.id)} />
              <div className="min-w-0 flex-1 basis-64">
                <Link to={`/admin/articles/${a.id}`} dir="auto" className="block truncate text-sm font-medium hover:text-ad-brand">{a.title}</Link>
                <p className="text-xs text-ad-mute">{catName(a.categoryId)} · {LANGS[a.language]} · {formatDate(a.updatedAt)}</p>
              </div>
              <StatusBadge status={a.status} />
              <div className="flex">
                <IconBtn icon="edit" label="Edit" onClick={() => nav(`/admin/articles/${a.id}`)} />
                <IconBtn icon="eye" label="Preview" onClick={() => window.open(`/admin/preview/${a.id}`, "_blank")} />
                <IconBtn icon="copy" label="Duplicate" onClick={() => duplicate(a)} />
                {a.status === "published" ? <button className="a-btn btn-cta ms-1 !py-1" onClick={() => act(a, "unpublish")}>Unpublish</button> : a.status !== "archived" ? <button className="a-btn-primary btn-cta ms-1 !py-1" onClick={() => act(a, "publish")}>Publish</button> : <button className="a-btn btn-cta ms-1 !py-1" onClick={() => act(a, "publish")}>Restore & publish</button>}
                <IconBtn icon="trash" label="Delete" danger onClick={() => remove(a)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-ad-mute">
        <button className="a-btn" disabled={f.page === 1} onClick={() => setF({ ...f, page: f.page - 1 })}>← Previous</button>
        <span>Page {f.page} of {pages}{data ? ` · ${data.total} articles` : ""}</span>
        <button className="a-btn" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next →</button>
      </div>
      <section className="mt-10 rounded-lg border border-ad-rule p-4" aria-label="Danger zone">
        <h2 className="text-sm font-semibold text-ad-danger">Danger zone</h2>
        <p className="mb-3 mt-1 text-xs text-ad-mute">Saare drafts aur published articles hamesha ke liye delete ho jayenge. Ye wapas nahi aa sakta.</p>
        <button className="a-btn-danger" onClick={removeAll}><Icon name="trash" size={15} />Delete all</button>
      </section>
      {dialog}
    </>
  );
}
