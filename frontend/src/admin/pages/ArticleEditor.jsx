import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { isSlug, slugify } from "../../lib/format.js";
import { newBlock, referenceIdsOf, withIds } from "../../lib/blocks.js";
import { BlockEditor } from "../components/BlockEditor.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { ErrorBox, Field, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";

const BLANK = { title: "", slug: "", language: "ur", categoryId: "", topicId: "", section: "", excerpt: "", seoTitle: "", seoDescription: "", coverKey: "", status: "draft" };
const pick = (a) => ({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, a[k] ?? ""])) });

export default function ArticleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [f, setF] = useState(BLANK);
  const [blocks, setBlocks] = useState(() => [newBlock("text")]);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const saved = useRef("");

  const cats = useAsync((s) => adminApi.categories.list({ status: "active" }, s), []);
  const topics = useAsync((s) => (f.categoryId ? adminApi.topics.list({ categoryId: f.categoryId, status: "active" }, s) : []), [f.categoryId]);
  const loaded = useAsync(async (s) => {
    if (isNew) return null;
    const a = await adminApi.articles.get(id, s);
    setF(pick(a)); setBlocks(withIds(a.blocks));
    saved.current = JSON.stringify([pick(a), withIds(a.blocks)]);
    return a;
  }, [id]);

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
    if (!isSlug(f.slug)) return toast("Slug must be lowercase letters/numbers with hyphens", "error"), null;
    if (!f.categoryId) return toast("Choose a category", "error"), null;
    const body = {
      categoryId: f.categoryId, topicId: f.topicId || null, title: f.title.trim(), slug: f.slug, language: f.language, blocks,
      references: referenceIdsOf(blocks), section: f.section || null, excerpt: f.excerpt.trim() || null,
      seoTitle: f.seoTitle.trim() || null, seoDescription: f.seoDescription.trim() || null, coverKey: f.coverKey || null,
    };
    setBusy(true);
    try {
      const a = isNew ? await adminApi.articles.create(body) : await adminApi.articles.update(id, body);
      saved.current = JSON.stringify([pick(a), withIds(a.blocks)]);
      toast("Saved");
      if (isNew) nav(`/admin/articles/${a.id}`, { replace: true });
      else { setF(pick(a)); loaded.reload(); }
      return a;
    } catch (e) { toast(e.message, "error"); return null; }
    finally { setBusy(false); }
  }

  async function transition(name) {
    const a = dirty ? await save() : { id };
    if (!a) return;
    try { await adminApi.articles.action(a.id, name); toast(`Article ${name === "archive" ? "archived" : name + "ed"}`); isNew ? nav(`/admin/articles/${a.id}`, { replace: true }) : loaded.reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function archive() {
    if (await confirm({ title: "Archive article", message: "It will be removed from the public site.", confirm: "Archive", danger: true })) transition("archive");
  }

  if (!isNew && loaded.loading && !loaded.data) return <Spinner />;
  if (!isNew && loaded.error && !loaded.data) return <ErrorBox error={loaded.error} onRetry={loaded.reload} />;

  const live = loaded.data?.status;
  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-ad-rule bg-ad-bg/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3"><Link to="/admin/articles" className="text-sm text-ad-mute hover:text-ad-ink">← Articles</Link>{!isNew && <StatusBadge status={live} />}{dirty && <span className="text-xs text-ad-warn">Unsaved changes</span>}</div>
        <div className="flex flex-wrap gap-2">
          {!isNew && <button className="a-btn" onClick={() => window.open(`/admin/preview/${id}`, "_blank")}>Preview</button>}
          <button className="a-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
          {live === "published" ? <button className="a-btn" onClick={() => transition("unpublish")}>Unpublish</button> : <button className="a-btn-primary" onClick={() => transition("publish")} disabled={busy}>Publish</button>}
          {!isNew && live !== "archived" && <button className="a-btn-danger" onClick={archive}>Archive</button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-6">
          <input className="a-input !py-3 !text-xl !font-semibold" dir="auto" placeholder="Article title" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value, slug: slugTouched ? s.slug : slugify(e.target.value) }))} />
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="a-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Settings</h2>
            <Field label="Slug *" hint="Used in the URL: /article/slug (must be unique)"><input className="a-input" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} /></Field>
            <Field label="Language"><select className="a-input" value={f.language} onChange={set("language")}><option value="ur">Urdu</option><option value="en">Roman (Hinglish)</option><option value="hi">Hindi</option><option value="ar">Arabic</option></select></Field>
            <Field label="Category *"><select className="a-input" value={f.categoryId} onChange={(e) => setF((s) => ({ ...s, categoryId: e.target.value, topicId: "" }))}>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === "aqeedah" ? "Aqaid" : "Masail"})</option>)}</select></Field>
            <Field label="Topic"><select className="a-input" value={f.topicId} onChange={set("topicId")}><option value="">— none —</option>{(topics.data || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
            <Field label="Topic section" hint="Where it appears on the topic page"><select className="a-input" value={f.section} onChange={set("section")}><option value="">General (More articles)</option><option value="dalail">Hamare Dalail</option><option value="radd">Dalail Ka Jaiza / Radd</option></select></Field>
          </div>
          <div className="a-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Excerpt & cover</h2>
            <Field label="Excerpt"><textarea className="a-input min-h-20" dir="auto" value={f.excerpt} onChange={set("excerpt")} /></Field>
            <div><span className="a-label">Cover image</span><MediaUploader value={f.coverKey} onChange={(coverKey) => setF((s) => ({ ...s, coverKey }))} label="Upload cover" /></div>
          </div>
          <div className="a-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">SEO</h2>
            <Field label="SEO title" hint={`${f.seoTitle.length}/60`}><input className="a-input" dir="auto" value={f.seoTitle} onChange={set("seoTitle")} /></Field>
            <Field label="Meta description" hint={`${f.seoDescription.length}/160`}><textarea className="a-input min-h-20" dir="auto" value={f.seoDescription} onChange={set("seoDescription")} /></Field>
          </div>
        </aside>
      </div>
      {dialog}
    </>
  );
}
