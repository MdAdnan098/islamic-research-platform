import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useState } from "react";
import { insertBlockInto, saveBlockEdit, saveHighlights, useIsAdmin } from "../../lib/adminHint.js";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { Skeleton, ErrorState, NotFoundState } from "../../components/ui/feedback.jsx";

export default function ArticlePage() {
  const { slug } = useParams();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [addOn, setAddOn] = useState(true);
  const [editOn, setEditOn] = useState(false);
  const { t } = useI18n();
  const { data, error, loading, reload, setData } = useAsync(async (signal) => {
    const { article, references, trail } = await publicApi.article(slug, signal);
    const section = trail?.section ? SECTION_PATH[trail.section] || "aqaid" : null;
    const base = section ? `/${section}` : null;
    const crumbs = [
      { label: t.nav.home, to: "/" },
      base && { label: section === "aqaid" ? t.nav.aqaid : t.nav.masail, to: base },
      ...((base && trail?.folders) || []).map((f) => ({ label: f.title, to: `${base}/${f.slug}` })),
    ].filter(Boolean);
    return { article, references, crumbs, sectionBase: base ? base.slice(1) : null };
  }, [slug]);

  if (loading && !data) {
    return <div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-4 w-1/3" /><Skeleton className="mt-8 h-40 w-full" /></div>;
  }
  if (error && !data) {
    return error.status === 404 ? <NotFoundState message={t.article.notFound} /> : <div className="container-read py-16"><ErrorState error={error} onRetry={reload} /></div>;
  }
  const editor = isAdmin && editing ? {
    enabled: true,
    onApply: async (edits) => {
      const saved = await saveHighlights(data.article, edits);
      setData((d) => ({ ...d, article: { ...d.article, blocks: saved.blocks, updatedAt: saved.updatedAt } }));
    },
  } : undefined;
  // Admin only: small "+ Add" under every block, saved straight into this post (no trip back to the dashboard).
  const inline = isAdmin && addOn ? {
    onInsert: async (index, block, afterId) => {
      const next = await insertBlockInto(data.article, data.references, index, afterId, block);
      setData((d) => ({ ...d, ...next }));
    },
  } : undefined;
  // Admin only: a pencil under every block; "Save & Publish" there stores the whole post and publishes it.
  const edit = isAdmin && editOn ? {
    onSave: async (index, block) => {
      const next = await saveBlockEdit(data.article, data.references, index, block);
      setData((d) => ({ ...d, ...next }));
    },
  } : undefined;
  const missingIds = (data.article.blocks || []).some((b) => ["heading", "text", "quote"].includes(b.type) && !b.id);
  return (
    <>
      <ArticleView {...data} editor={editor} inline={inline} edit={edit} />
      {isAdmin && (
        <div dir="ltr" className="fixed bottom-4 start-4 z-[60] flex max-w-[80vw] flex-col gap-1 rounded-xl border border-rule bg-paper px-3 py-2 text-xs text-ink shadow-elev">
          <button type="button" aria-pressed={editing} onClick={() => setEditing((v) => !v)} className="font-semibold">
            Admin · Highlight mode: {editing ? "ON" : "OFF"}
          </button>
          <button type="button" aria-pressed={addOn} onClick={() => setAddOn((v) => !v)} className="text-start font-semibold">
            Admin · Add buttons: {addOn ? "ON" : "OFF"}
          </button>
          <button type="button" aria-pressed={editOn} onClick={() => setEditOn((v) => !v)} className="text-start font-semibold">
            Admin · Edit buttons: {editOn ? "ON" : "OFF"}
          </button>
          {editing && missingIds && <span className="text-mute">Is article ko ek baar editor mein kholkar Save karein, tab highlight chalega.</span>}
          {editing && !missingIds && <span className="text-mute">Text select karein, phir Highlight dabayein.</span>}
        </div>
      )}
    </>
  );
}
