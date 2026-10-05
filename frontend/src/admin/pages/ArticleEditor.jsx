import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { isSlug, slugify } from "../../lib/format.js";
import { newBlock, referenceIdsOf, withIds } from "../../lib/blocks.js";
import { BlockEditor } from "../components/BlockEditor.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { VersionsPanel } from "../components/VersionsPanel.jsx";
import { detectLang } from "../../lib/versions.js";
import { ErrorBox, Field, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";

const BLANK = { titleTr: {}, title: "", slug: "", language: "ur", categoryId: "", topicId: "", section: "", excerpt: "", seoTitle: "", seoDescription: "", coverKey: "", status: "draft" };
const pick = (a) => ({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, a[k] ?? ""])), titleTr: a.titleTr || {} });

export default function ArticleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [f, setF] = useState(BLANK);
  const [blocks, setBlocks] = useState(() => [newBlock("text")]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const lang = detectLang(f.title, blocks); // the script the admin wrote in
  const saved = useRef("");

  const cats = useAsync((s) => adminApi.categories.list({ status: "active" }, s), []);
  const loaded = useAsync(async (s) => {
    if (isNew) return null;
    const a = await adminApi.articles.get(id, s);
    setF(pick(a)); setBlocks(withIds(a.blocks));
    saved.current = JSON.stringify([pick(a), withIds(a.blocks)]);
    return a;
  }, [id]);

  // First run: no categories yet -> create "Aqaid" and "Masail" so the dropdown is never empty.
  const seeded = useRef(false);
  useEffect(() => {
    if (!cats.data || cats.data.length || seeded.current) return;
    seeded.current = true;
    Promise.all([["Aqaid", "aqaid", "aqeedah"], ["Masail", "masail", "masail"]].map(([name, slug, type], ordering) => adminApi.categories.create({ name, slug, description: null, type, status: "active", ordering })))
      .then(() => cats.reload()).catch(() => {});
  }, [cats.data]);

  // Default category for brand-new articles.
  useEffect(() => { if (isNew && !f.categoryId && cats.data?.[0]) setF((s) => ({ ...s, categoryId: cats.data[0].id })); }, [isNew, cats.data, f.categoryId]);

  const dirty = useMemo(() => (isNew ? f.title || blocks.length > 0 : JSON.stringify([f, blocks]) !== saved.current), [f, blocks, isNew]);
  useEffect(() => {
    const warn = (e) => dirty && (e.preventDefault(), (e.returnValue = ""));
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    if (!f.title.trim()) return toast("Title is required", "error"), null;
    if (!f.categoryId) return toast("Category chuniye (Aqaid ya Masail)", "error"), null;
    // The link name is created automatically; Urdu/Hindi titles get a random one.
    let slug = isSlug(f.slug) ? f.slug : slugify(f.slug || f.title);
    if (!isSlug(slug)) slug = "article-" + Math.random().toString(36).slice(2, 8);
    if (slug !== f.slug) setF((s) => ({ ...s, slug }));
    const body = {
      categoryId: f.categoryId, topicId: f.topicId || null, title: f.title.trim(), titleTr: Object.fromEntries(Object.entries(f.titleTr || {}).filter(([, v]) => v && v.trim())), slug, language: lang || "en", blocks,
      references: referenceIdsOf(blocks), section: f.section || null, excerpt: f.excerpt.trim() || null,
      seoTitle: f.seoTitle.trim() || null, seoDescription: f.seoDescription.trim() || null, coverKey: f.coverKey || null,
    };
    setBusy(true);
    try {
      let a;
      try {
        a = isNew ? await adminApi.articles.create(body) : await adminApi.articles.update(id, body);
      } catch (e) {
        // Same link name already used by another article: add a short suffix and retry once.
        if (!isNew || !/slug/i.test(e.message)) throw e;
        a = await adminApi.articles.create({ ...body, slug: `${slug}-${Math.random().toString(36).slice(2, 6)}` });
      }
      saved.current = JSON.stringify([pick(a), withIds(a.blocks)]);
      toast("Saved");
      if (isNew) nav(`/admin/articles/${a.id}`, { replace: true });
      else { setF(pick(a)); loaded.reload(); }
      return a;
    } catch (e) { toast(e.message, "error"); return null; }
    finally { setBusy(false); }
  }

  async function openPreview() {
    setPreview({ refs: [] });
    const refs = (await Promise.all(referenceIdsOf(blocks).map((r) => adminApi.references.get(r).catch(() => null)))).filter(Boolean);
    setPreview({ refs });
  }

  async function transition(name) {
    const a = dirty ? await save() : { id };
    if (!a) return;
    try { await adminApi.articles.action(a.id, name); toast(`Article ${name === "archive" ? "archived" : name + "ed"}`); isNew ? nav(`/admin/articles/${a.id}`, { replace: true }) : loaded.reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    if (!(await confirm({ title: "Article delete karein?", message: "Ye article hamesha ke liye delete ho jayega. Ye wapas nahi aa sakta.", confirm: "Delete", danger: true }))) return;
    try { await adminApi.articles.remove(id); saved.current = null; toast("Article delete ho gaya"); nav("/admin/articles", { replace: true }); } catch (e) { toast(e.message, "error"); }
  }

  if (!isNew && loaded.loading && !loaded.data) return <Spinner />;
  if (!isNew && loaded.error && !loaded.data) return <ErrorBox error={loaded.error} onRetry={loaded.reload} />;

  const live = loaded.data?.status;
  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-ad-rule bg-ad-bg/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3"><Link to="/admin/articles" className="text-sm text-ad-mute hover:text-ad-ink">← Articles</Link>{!isNew && <StatusBadge status={live} />}{dirty && <span className="text-xs text-ad-warn">Unsaved changes</span>}</div>
        <div className="flex flex-wrap gap-2">
          <button className="a-btn inline-flex items-center gap-1.5" onClick={openPreview} title="Ab tak jitna likha hai uska preview"><Icon name="eye" size={16} />Preview</button>
          <button className="a-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
          {live === "published" ? <button className="a-btn" onClick={() => transition("unpublish")}>Unpublish</button> : <button className="a-btn-primary" onClick={() => transition("publish")} disabled={busy}>Publish</button>}
          {!isNew && <button className="a-btn-danger" onClick={remove}><Icon name="trash" size={15} /> Delete</button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-6">
          <input className="a-input !py-3 !text-xl !font-semibold" dir="auto" placeholder="Article title" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value, slug: isNew ? slugify(e.target.value) : s.slug }))} />
          <BlockEditor blocks={blocks} onChange={setBlocks} />
          <VersionsPanel baseLang={lang} title={f.title} titleTr={f.titleTr} setTitleTr={(titleTr) => setF((s) => ({ ...s, titleTr }))} blocks={blocks} setBlocks={setBlocks} toast={toast} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="a-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Settings</h2>
            <Field label="Category *"><select className="a-input" value={f.categoryId} onChange={(e) => setF((s) => ({ ...s, categoryId: e.target.value, topicId: "" }))}>
              {[["aqeedah", "Aqaid"], ["masail", "Masail"]].map(([type, label]) => {
                const items = (cats.data || []).filter((c) => c.type === type);
                return items.length ? <optgroup key={type} label={label}>{items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null;
              })}
            </select></Field>
            <Field label="Sub category"><select className="a-input" value={f.section || ""} onChange={set("section")}>
              <option value="">General</option>
              <option value="dalail">Hamare Dalail</option>
              <option value="radd">Dalail Ka Radd</option>
            </select></Field>
          </div>
          <div className="a-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Cover image</h2>
            <div><MediaUploader value={f.coverKey} onChange={(coverKey) => setF((s) => ({ ...s, coverKey }))} label="Upload cover" /></div>
          </div>
        </aside>
      </div>
      {dialog}
      {preview && createPortal(
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-paper font-sans text-ink">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-card/95 px-4 py-2.5 backdrop-blur">
            <span className="text-sm font-medium">Preview — abhi tak ka likha hua (save nahi hua)</span>
            <button className="rounded-lg border border-rule px-3 py-1 text-sm hover:border-accent/60" onClick={() => setPreview(null)}>✕ Band karein</button>
          </div>
          <ArticleView article={{ ...f, language: lang || "en", title: f.title.trim() || "(Title abhi nahi likha)", blocks, excerpt: f.excerpt.trim() || null, coverKey: f.coverKey || null, createdAt: new Date().toISOString() }} references={preview.refs} />
        </div>,
        document.body
      )}
    </>
  );
}
