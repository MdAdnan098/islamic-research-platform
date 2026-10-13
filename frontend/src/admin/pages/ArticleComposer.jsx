import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { isSlug, slugify } from "../../lib/format.js";
import { referenceIdsOf, withIds } from "../../lib/blocks.js";
import { cleanBlocksHl } from "../../lib/highlights.js";
import { detectLang } from "../../lib/versions.js";
import { flattenTree, folderLabel } from "../../lib/folders.js";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { PublicLayout } from "../../layouts/PublicLayout.jsx";
import { ErrorState, Skeleton } from "../../components/ui/feedback.jsx";
import { StatusBadge, useToast } from "../components/ui.jsx";

const TITLE_BACKUP = "fs_compose_title";
const readTitle = () => { try { return localStorage.getItem(TITLE_BACKUP) || ""; } catch { return ""; } };
const writeTitle = (v) => { try { v ? localStorage.setItem(TITLE_BACKUP, v) : localStorage.removeItem(TITLE_BACKUP); } catch { /* ignore */ } };
const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * "New article" as a live page: the post looks exactly like it will on the site (heading, paragraphs, references,
 * images ...). The heading is a field at the top; under every block there are Edit / Add buttons. Every Save stores the
 * WHOLE post as a draft (the first one creates it), so nothing is lost if the browser reloads the tab.
 */
export default function ArticleComposer() {
  const { id: routeId } = useParams();
  const toast = useToast();
  const nav = useNavigate();

  const [id, setId] = useState(routeId || null);
  const [title, setTitle] = useState(() => (routeId ? "" : readTitle()));
  const [blocks, setBlocks] = useState([]);
  const [refs, setRefs] = useState([]);
  const [meta, setMeta] = useState({ categoryId: "", topicId: "", slug: "", status: "draft" });
  const [status, setStatus] = useState({ text: "", tone: "" });
  const [busy, setBusy] = useState(false);

  const latest = useRef({});
  latest.current = { id, title, blocks, meta, refs };
  const rev = useRef(null); // updatedAt of the stored copy this page is based on
  const savedTitle = useRef("");
  const chain = useRef(Promise.resolve());

  const cats = useAsync((s) => adminApi.categories.list({ status: "active" }, s), []);
  const topicsRes = useAsync((s) => (meta.categoryId ? adminApi.topics.list({ categoryId: meta.categoryId }, s) : []), [meta.categoryId]);
  const topicOptions = flattenTree((topicsRes.data || []).filter((t) => t.status === "active" || t.id === meta.topicId));

  // An existing article opens with its stored content.
  const loaded = useAsync(async (s) => {
    if (!routeId) return null;
    const a = await adminApi.articles.get(routeId, s);
    setTitle(a.title); savedTitle.current = a.title;
    setBlocks(withIds(a.blocks));
    setMeta({ categoryId: a.categoryId, topicId: a.topicId || "", slug: a.slug, status: a.status });
    rev.current = a.updatedAt;
    const found = await Promise.all(referenceIdsOf(a.blocks).map((r) => adminApi.references.get(r, s).catch(() => null)));
    setRefs(found.filter(Boolean));
    return a;
  }, [routeId]);

  // First run: no categories yet -> create "Aqaid" and "Masail" so the dropdown is never empty (same as the form editor).
  const seeded = useRef(false);
  useEffect(() => {
    if (!cats.data || cats.data.length || seeded.current) return;
    seeded.current = true;
    Promise.all([["Aqaid", "aqaid", "aqeedah"], ["Masail", "masail", "masail"]].map(([name, slug, type], ordering) => adminApi.categories.create({ name, slug, description: null, type, status: "active", ordering })))
      .then(() => cats.reload()).catch(() => {});
  }, [cats.data]);
  useEffect(() => { if (!routeId && !meta.categoryId && cats.data?.[0]) setMeta((m) => ({ ...m, categoryId: cats.data[0].id })); }, [routeId, cats.data, meta.categoryId]);

  /**
   * Stores the whole post. `mutate(currentBlocks)` returns the new blocks (omit it to save as it is now).
   * Calls run one after another, so a heading autosave and a block save can never overtake each other.
   */
  function persist(mutate, titleNow) {
    const run = async () => {
      const cur = latest.current;
      const t = (titleNow ?? cur.title).trim();
      if (!t) throw new Error("Pehle upar heading likhein, uske baad hi post save hogi.");
      if (!cur.meta.categoryId) throw new Error("Pehle category chuniye (upar Category).");
      const base = withIds(cur.blocks);
      const next = mutate ? mutate(base) : base;
      const language = detectLang(t, next) || "en";
      const body = {
        categoryId: cur.meta.categoryId, topicId: cur.meta.topicId || null, title: t, language,
        blocks: cleanBlocksHl(next, language), references: referenceIdsOf(next),
      };
      let a;
      if (!cur.id) {
        let slug = isSlug(slugify(t)) ? slugify(t) : "article-" + Math.random().toString(36).slice(2, 8);
        try { a = await adminApi.articles.create({ ...body, slug }); } catch (e) {
          if (!/slug/i.test(e.message)) throw e;
          a = await adminApi.articles.create({ ...body, slug: `${slug}-${Math.random().toString(36).slice(2, 6)}` });
        }
        setId(a.id);
        try { window.history.replaceState(null, "", `/admin/articles/${a.id}/write`); } catch { /* ignore */ }
        writeTitle("");
      } else {
        a = await adminApi.articles.update(cur.id, { ...body, baseUpdatedAt: rev.current });
      }
      rev.current = a.updatedAt;
      savedTitle.current = a.title;
      const saved = withIds(a.blocks);
      // Updated at once (not only on the next render) so a queued save sees the new id / blocks.
      latest.current = { ...latest.current, id: a.id, blocks: saved, meta: { ...cur.meta, slug: a.slug, status: a.status } };
      setBlocks(saved);
      setMeta((m) => ({ ...m, slug: a.slug, status: a.status }));
      // references used by the blocks are loaded so they are drawn straight away
      const known = new Map(cur.refs.map((r) => [r.id, r]));
      const need = referenceIdsOf(a.blocks);
      const fresh = await Promise.all(need.map((rid) => (known.has(rid) ? known.get(rid) : adminApi.references.get(rid).catch(() => null))));
      setRefs(fresh.filter(Boolean));
      setStatus({ text: a.status === "published" ? `Live post update ho gayi · ${clock()}` : `Draft save ho gaya · ${clock()}`, tone: "ok" });
      return a;
    };
    const p = chain.current.then(run);
    chain.current = p.catch(() => {});
    return p;
  }

  async function saveNow() {
    setBusy(true); setStatus({ text: "Saving…", tone: "" });
    try { await persist(); } catch (e) { setStatus({ text: e.message, tone: "err" }); toast(e.message, "error"); } finally { setBusy(false); }
  }

  async function publishToggle() {
    setBusy(true);
    try {
      const a = await persist();
      const next = a.status === "published" ? "unpublish" : "publish";
      const r = await adminApi.articles.action(a.id, next);
      setMeta((m) => ({ ...m, status: r.status })); rev.current = r.updatedAt;
      toast(next === "publish" ? "Post publish ho gayi" : "Post draft mein wapas gayi");
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }

  // The heading is saved as soon as the admin leaves the field (only when it changed).
  function onTitleBlur() {
    const t = title.trim();
    if (!t || t === savedTitle.current) return;
    if (!meta.categoryId) return;
    setStatus({ text: "Saving…", tone: "" });
    persist(undefined, t).catch((e) => setStatus({ text: e.message, tone: "err" }));
  }

  const inline = {
    scope: id || "new",
    onInsert: async (index, block, afterId) => {
      await persist((cur) => {
        const at = afterId && cur.some((b) => b.id === afterId) ? cur.findIndex((b) => b.id === afterId) : Math.min(index, cur.length - 1);
        return [...cur.slice(0, at + 1), block, ...cur.slice(at + 1)];
      });
    },
  };
  const edit = {
    saveLabel: meta.status === "published" ? "Save (live update)" : "Save Draft",
    onSave: async (index, nb) => {
      await persist((cur) => {
        let at = nb.id ? cur.findIndex((b) => b.id === nb.id) : -1;
        if (at < 0) at = index;
        if (at < 0 || at >= cur.length) throw new Error("Ye hissa post mein nahi mila. Page refresh karke dobara koshish karein.");
        return cur.map((b, i) => (i === at ? { ...nb, id: b.id } : b));
      });
    },
  };

  const titleField = (
    <div dir="ltr" className="font-sans">
      <input
        className="a-input !py-3.5 !text-xl !font-semibold"
        dir="auto"
        autoFocus={!routeId}
        placeholder="Post ka heading yahan likhein (zaroori)"
        value={title}
        onChange={(e) => { setTitle(e.target.value); if (!id) writeTitle(e.target.value); }}
        onBlur={onTitleBlur}
        aria-label="Heading"
      />
      {!title.trim() && <p className="mt-1.5 text-xs text-mute">Heading ke bina post save nahi hogi. Heading likhne ke baad neeche Add button se paragraph, reference, image jodein.</p>}
    </div>
  );

  if (routeId && loaded.loading && !loaded.data) return <PublicLayout><div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-40 w-full" /></div></PublicLayout>;
  if (routeId && loaded.error && !loaded.data) return <PublicLayout><div className="container-read py-16"><ErrorState error={loaded.error} onRetry={loaded.reload} /></div></PublicLayout>;

  const live = meta.status === "published";
  return (
    <PublicLayout>
      <div dir="ltr" className="sticky top-0 z-[45] border-b border-rule bg-card/95 px-3 py-2 font-sans text-sm text-ink backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
          <Link to="/admin/articles" className="text-mute hover:text-ink">← Articles</Link>
          {id && <StatusBadge status={meta.status} />}
          <span className={`text-xs ${status.tone === "err" ? "text-ad-danger" : status.tone === "ok" ? "text-ad-ok" : "text-mute"}`}>{status.text || (id ? "" : "Naya post — heading likhein")}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button type="button" className="a-btn" disabled={busy} onClick={saveNow}>{busy ? "Saving…" : live ? "Save" : "Save Draft"}</button>
            <button type="button" className="a-btn-primary" disabled={busy} onClick={publishToggle}>{live ? "Unpublish" : "Publish"}</button>
            {id && <Link to={`/admin/articles/${id}`} className="a-btn" title="Urdu / Roman convert, cover image, excerpt, SEO">Convert &amp; settings</Link>}
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-mute">Category
            <select className="a-input !w-auto !py-1" value={meta.categoryId} onChange={(e) => setMeta((m) => ({ ...m, categoryId: e.target.value, topicId: "" }))}>
              {[["aqeedah", "Aqaid"], ["masail", "Masail"]].map(([type, label]) => {
                const items = (cats.data || []).filter((c) => c.type === type);
                return items.length ? <optgroup key={type} label={label}>{items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-mute">Folder
            <select className="a-input !w-auto !max-w-[16rem] !py-1" dir="auto" value={meta.topicId || ""} onChange={(e) => setMeta((m) => ({ ...m, topicId: e.target.value }))}>
              <option value="">— koi nahi —</option>
              {topicOptions.map((t) => <option key={t.id} value={t.id}>{folderLabel(t)}</option>)}
            </select>
          </label>
          <span className="text-xs text-mute">Category / folder badalne ke baad agla Save unhe lagayega.</span>
        </div>
      </div>
      <ArticleView
        article={{ title, language: detectLang(title, blocks) || "en", blocks, titleTr: null, createdAt: new Date().toISOString() }}
        references={refs}
        titleNode={titleField}
        inline={inline}
        edit={edit}
      />
    </PublicLayout>
  );
}
