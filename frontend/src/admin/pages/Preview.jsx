import { useState } from "react";
import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAdminDraft } from "../../lib/adminDraft.js";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import AdminDock from "../components/AdminDock.jsx";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { PublicLayout } from "../../layouts/PublicLayout.jsx";
import { ErrorState, Skeleton } from "../../components/ui/feedback.jsx";

const PublishBar = lazy(() => import("../components/PublishBar.jsx"));

/** Renders a saved article (any status) exactly as the public site would. */
export default function Preview() {
  const { id } = useParams();
  const [hlOn, setHlOn] = useState(false);
  const [editOn, setEditOn] = useState(false);
  const { data, error, loading, reload, setData } = useAsync(async (s) => {
    const article = await adminApi.articles.get(id, s);
    const ids = [...new Set((article.blocks || []).filter((b) => b.type === "reference" && b.referenceId).map((b) => b.referenceId))];
    const references = (await Promise.all(ids.map((r) => adminApi.references.get(r, s).catch(() => null)))).filter(Boolean);
    return { article, references };
  }, [id]);

  const draft = useAdminDraft({ article: data?.article, references: data?.references, enabled: !!data, initial: data?.article });
  const shown = data && draft.blocks ? { ...data.article, blocks: draft.blocks } : data?.article;
  const shownRefs = draft.ready ? draft.references : data?.references;

  return (
    <PublicLayout>
      {loading && !data ? <div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-40 w-full" /></div>
        : error && !data ? <div className="container-read py-16"><ErrorState error={error} onRetry={reload} /></div>
        : (
          <>
            <ArticleView article={shown} references={shownRefs} crumbs={[]} edit={editOn ? { saveLabel: "Save", onSave: draft.ops.onSave, onRemove: draft.ops.onRemove } : undefined} inline={{ scope: id, onInsert: draft.ops.onInsert }} banner={data.article.status !== "published" ? `Preview — status: ${data.article.status}. Not visible to the public.` : draft.hasDraft ? "Preview — live post mein ye badlav abhi publish nahi hue (Save & Publish dabayein)." : "Preview — this article is live."}
              editor={hlOn ? { enabled: true, onApply: draft.ops.onApply, onTransform: draft.ops.onTransform, onAlign: draft.ops.onAlign } : undefined} />
            <AdminDock>
              <button type="button" aria-pressed={hlOn} onClick={() => setHlOn((v) => !v)} className="text-start font-semibold">Highlight / Format mode: {hlOn ? "ON" : "OFF"}</button>
              <button type="button" aria-pressed={editOn} onClick={() => setEditOn((v) => !v)} className="text-start font-semibold">Edit buttons: {editOn ? "ON" : "OFF"}</button>
              <Suspense fallback={null}><PublishBar draft={draft} /></Suspense>
            </AdminDock>
          </>
        )}
    </PublicLayout>
  );
}
