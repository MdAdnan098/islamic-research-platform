import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate } from "../../lib/format.js";
import { cloneBlocks } from "../../lib/blocks.js";
import { Empty, ErrorBox, IconBtn, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import AdminSearch from "../components/AdminSearch.jsx";

const LIMIT = 20;
const LANGS = { ur: "اردو", en: "Roman", hi: "हिन्दी", ar: "العربية" };

export default function Articles() {
  const toast = useToast();
  const nav = useNavigate();
  const [confirm, dialog] = useConfirm();
  const [f, setF] = useState({ q: "", page: 1 });
  // The search runs on the server (all articles, not just this page); it waits a moment after the last key.
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setQ(f.q.trim()); setF((s) => (s.page === 1 ? s : { ...s, page: 1 })); }, 350);
    return () => clearTimeout(t);
  }, [f.q]);
  const cats = useAsync((s) => adminApi.categories.list({}, s), []);
  const { data, error, loading, reload } = useAsync(
    (s) => adminApi.articles.listPage({ q, page: f.page, limit: LIMIT }, s),
    [q, f.page]
  );
  // Bulk select: ids ticked on THIS page (cleared whenever the list changes: filter, search or page).
  const [picked, setPicked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => { setPicked(new Set()); }, [q, f.page]);
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
        <Link to="/admin/articles/new" className="a-btn-primary btn-cta">🖋 Write article</Link>
      </PageHeader>
      <AdminSearch value={f.q} onChange={(v) => setF((s0) => ({ ...s0, q: v }))} placeholder="Article search karein (kisi bhi zubaan mein)…" className="mx-auto mb-5 w-full max-w-xl" />

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
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? <Empty>No articles found.</Empty> : (
        <div className="a-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ad-rule px-4 py-2 text-xs text-ad-mute">
            <label className="flex w-fit items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={allPicked} disabled={bulkBusy} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((a) => a.id)))} />
              Select all articles
            </label>
            {data && <span className="shrink-0 text-[11px] opacity-70">{data.total} articles</span>}
          </div>
          <ul className="divide-y divide-ad-rule">
            {rows.map((a) => (
              <li key={a.id} className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`Select ${a.title}`} checked={picked.has(a.id)} disabled={bulkBusy} onChange={() => toggle(a.id)} />
                <div className="min-w-0 flex-1 basis-64">
                  <Link to={`/admin/articles/${a.id}`} dir="auto" className="block truncate text-sm font-medium hover:text-ad-brand">{a.title}</Link>
                  <p className="text-xs text-ad-mute">{catName(a.categoryId)} · {LANGS[a.language]} · {formatDate(a.updatedAt)}</p>
                </div>
                <StatusBadge status={a.status} />
                <div className="flex items-center gap-3">
                  <IconBtn icon="copy" label="Duplicate" onClick={() => duplicate(a)} />
                  {a.status === "published" ? <button className="a-btn btn-cta !px-2.5 !py-0.5 !text-xs" onClick={() => act(a, "unpublish")}>Unpublish</button> : a.status !== "archived" ? <button className="a-btn-primary btn-cta !px-2.5 !py-0.5 !text-xs" onClick={() => act(a, "publish")}>Publish</button> : <button className="a-btn btn-cta !px-2.5 !py-0.5 !text-xs" onClick={() => act(a, "publish")}>Restore & publish</button>}
                  <span className="ms-3"><IconBtn icon="trash" label="Delete" danger onClick={() => remove(a)} /></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 items-center text-xs text-ad-mute">
        <button className="a-btn justify-self-start !px-2.5 !py-1 !text-xs" disabled={f.page === 1} onClick={() => setF({ ...f, page: f.page - 1 })}>← Previous</button>
        <span className="text-center">Page {f.page} of {pages}</span>
        <button className="a-btn justify-self-end !px-2.5 !py-1 !text-xs" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next →</button>
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
