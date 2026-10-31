import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { lazy, Suspense, useState } from "react";
import { useIsAdmin } from "../../lib/adminHint.js";
import { useAdminDraft } from "../../lib/adminDraft.js";
import AdminDock from "../../admin/components/AdminDock.jsx";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { Skeleton, ErrorState, NotFoundState } from "../../components/ui/feedback.jsx";
import { DEMO_ARTICLE_PAYLOAD } from "../../config/demoArticle.js";

// Admin-only "Save & Publish" block of the admin panel: loaded on demand.
const PublishBar = lazy(() => import("../../admin/components/PublishBar.jsx"));

export default function ArticlePage() {
  const { slug } = useParams();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [addOn, setAddOn] = useState(true);
  const [editOn, setEditOn] = useState(false);
  const { t } = useI18n();
  const { data, error, loading, reload, setData } = useAsync(async (signal) => {
    if (slug === "demo" || slug === "sample") {
      const { article, references, trail } = DEMO_ARTICLE_PAYLOAD;
      const base = "/aqaid";
      const crumbs = [
        { label: t.nav.home, to: "/" },
        { label: t.nav.aqaid, to: base },
        ...trail.folders.map((f) => ({ label: f.title, to: `${base}/${f.slug}` })),
      ];
      return { article, references, crumbs, sectionBase: "aqaid" };
    }
    try {
      const { article, references, trail } = await publicApi.article(slug, signal);
      const section = trail?.section ? SECTION_PATH[trail.section] || "aqaid" : null;
      const base = section ? `/${section}` : null;
      const crumbs = [
        { label: t.nav.home, to: "/" },
        base && { label: section === "aqaid" ? t.nav.aqaid : t.nav.masail, to: base },
        ...((base && trail?.folders) || []).map((f) => ({ label: f.title, to: `${base}/${f.slug}` })),
      ].filter(Boolean);
      return { article, references, crumbs, sectionBase: base ? base.slice(1) : null };
    } catch (err) {
      if (import.meta.env.DEV) {
        const { article, references, trail } = DEMO_ARTICLE_PAYLOAD;
        const base = "/aqaid";
        const crumbs = [
          { label: t.nav.home, to: "/" },
          { label: t.nav.aqaid, to: base },
          ...trail.folders.map((f) => ({ label: f.title, to: `${base}/${f.slug}` })),
        ];
        return { article, references, crumbs, sectionBase: "aqaid" };
      }
      throw err;
    }
  }, [slug]);

  // Admin only: every change is auto-saved as a draft; "Save & Publish" makes it the live post.
  const draft = useAdminDraft({ article: data?.article, references: data?.references, enabled: isAdmin && !!data });

  if (loading && !data) {
    return <div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-4 w-1/3" /><Skeleton className="mt-8 h-40 w-full" /></div>;
  }
  if (error && !data) {
    return error.status === 404 ? <NotFoundState message={t.article.notFound} /> : <div className="container-read py-16"><ErrorState error={error} onRetry={reload} /></div>;
  }
  const shown = isAdmin && draft.blocks ? { ...data.article, blocks: draft.blocks } : data.article;
  const shownRefs = isAdmin && draft.ready ? draft.references : data.references;
  const editor = isAdmin && editing ? { enabled: true, onApply: draft.ops.onApply, onTransform: draft.ops.onTransform, onAlign: draft.ops.onAlign } : undefined;
  // Admin only: small "+ Add" under every block, auto-saved into the draft (no trip back to the dashboard).
  const inline = isAdmin && addOn ? { scope: data.article.id, onInsert: draft.ops.onInsert } : undefined;
  // Admin only: Edit + Delete under every block. Edit "Save" stores the draft; "Save & Publish" in the panel publishes it.
  const edit = isAdmin && editOn ? { saveLabel: "Save", onSave: draft.ops.onSave, onRemove: draft.ops.onRemove } : undefined;
  const missingIds = (shown.blocks || []).some((b) => ["heading", "text", "quote"].includes(b.type) && !b.id);
  return (
    <>
      <ArticleView {...data} article={shown} references={shownRefs} editor={editor} inline={inline} edit={edit} />
      {isAdmin && (
        <AdminDock>
          <button type="button" aria-pressed={editing} onClick={() => setEditing((v) => !v)} className="font-semibold">
            Admin · Highlight / Format mode: {editing ? "ON" : "OFF"}
          </button>
          <button type="button" aria-pressed={addOn} onClick={() => setAddOn((v) => !v)} className="text-start font-semibold">
            Admin · Add buttons: {addOn ? "ON" : "OFF"}
          </button>
          <button type="button" aria-pressed={editOn} onClick={() => setEditOn((v) => !v)} className="text-start font-semibold">
            Admin · Edit buttons: {editOn ? "ON" : "OFF"}
          </button>
          {editing && missingIds && <span className="text-mute">Is article ko ek baar editor mein kholkar Save karein, tab highlight chalega.</span>}
          {editing && !missingIds && <span className="text-mute">Text select karein: Highlight, Bold, Color ya H2/H3 lagayein.</span>}
          <Suspense fallback={null}><PublishBar draft={draft} /></Suspense>
        </AdminDock>
      )}
    </>
  );
}
