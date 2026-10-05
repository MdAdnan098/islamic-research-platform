import { useState } from "react";
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
  const cats = useAsync((s) => adminApi.categories.list({}, s), []);
  const { data, error, loading, reload } = useAsync(
    (s) => adminApi.articles.list({ status: f.status, language: f.language, categoryId: f.categoryId, page: f.page, limit: LIMIT }, s),
    [f.status, f.language, f.categoryId, f.page]
  );
  const catName = (id) => cats.data?.find((c) => c.id === id)?.name || "—";
  const rows = (data || []).filter((a) => a.title.toLowerCase().includes(f.q.toLowerCase()));

  async function act(a, name) {
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
  async function duplicate(a) {
    try {
      const copy = await adminApi.articles.create({
        categoryId: a.categoryId, topicId: a.topicId, title: `${a.title} (copy)`, slug: `${a.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
        language: a.language, blocks: cloneBlocks(a.blocks), references: a.references, section: a.section, excerpt: a.excerpt,
        seoTitle: a.seoTitle, seoDescription: a.seoDescription, coverKey: a.coverKey,
      });
      toast("Duplicated as draft"); nav(`/admin/articles/${copy.id}`);
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="Articles" desc="Research articles, in every language.">
        <button className="a-btn-danger" onClick={removeAll}><Icon name="trash" size={15} />Delete all</button>
        <Link to="/admin/articles/new" className="a-btn-primary"><Icon name="plus" size={15} />New article</Link>
      </PageHeader>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="a-input" dir="auto" placeholder="Search title…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="a-input" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
        <select className="a-input" value={f.language} onChange={(e) => set({ language: e.target.value })}><option value="">All languages</option>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="a-input" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}><option value="">All categories</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? <Empty>No articles found.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {rows.map((a) => (
            <li key={a.id} className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <Link to={`/admin/articles/${a.id}`} dir="auto" className="block truncate text-sm font-medium hover:text-ad-brand">{a.title}</Link>
                <p className="text-xs text-ad-mute">{catName(a.categoryId)} · {LANGS[a.language]} · {formatDate(a.updatedAt)}</p>
              </div>
              <StatusBadge status={a.status} />
              <div className="flex">
                <IconBtn icon="edit" label="Edit" onClick={() => nav(`/admin/articles/${a.id}`)} />
                <IconBtn icon="eye" label="Preview" onClick={() => window.open(`/admin/preview/${a.id}`, "_blank")} />
                <IconBtn icon="copy" label="Duplicate" onClick={() => duplicate(a)} />
                {a.status === "published" ? <button className="a-btn ms-1 !py-1" onClick={() => act(a, "unpublish")}>Unpublish</button> : a.status !== "archived" ? <button className="a-btn-primary ms-1 !py-1" onClick={() => act(a, "publish")}>Publish</button> : <button className="a-btn ms-1 !py-1" onClick={() => act(a, "publish")}>Restore & publish</button>}
                <IconBtn icon="trash" label="Delete" danger onClick={() => remove(a)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-ad-mute">
        <button className="a-btn" disabled={f.page === 1} onClick={() => setF({ ...f, page: f.page - 1 })}>← Previous</button>
        <span>Page {f.page}</span>
        <button className="a-btn" disabled={(data?.length || 0) < LIMIT} onClick={() => setF({ ...f, page: f.page + 1 })}>Next →</button>
      </div>
      {dialog}
    </>
  );
}
