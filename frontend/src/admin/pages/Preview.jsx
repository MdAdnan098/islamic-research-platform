import { useState } from "react";
import { useParams } from "react-router-dom";
import { saveHighlights } from "../../lib/adminHint.js";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { PublicLayout } from "../../layouts/PublicLayout.jsx";
import { ErrorState, Skeleton } from "../../components/ui/feedback.jsx";

/** Renders a saved article (any status) exactly as the public site would. */
export default function Preview() {
  const { id } = useParams();
  const [hlOn, setHlOn] = useState(false);
  const { data, error, loading, reload, setData } = useAsync(async (s) => {
    const article = await adminApi.articles.get(id, s);
    const ids = [...new Set((article.blocks || []).filter((b) => b.type === "reference" && b.referenceId).map((b) => b.referenceId))];
    const references = (await Promise.all(ids.map((r) => adminApi.references.get(r, s).catch(() => null)))).filter(Boolean);
    return { article, references };
  }, [id]);

  return (
    <PublicLayout>
      {loading && !data ? <div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-40 w-full" /></div>
        : error && !data ? <div className="container-read py-16"><ErrorState error={error} onRetry={reload} /></div>
        : (
          <>
            <ArticleView {...data} banner={data.article.status !== "published" ? `Preview — status: ${data.article.status}. Not visible to the public.` : "Preview — this article is live."}
              editor={hlOn ? { enabled: true, onApply: async (edits) => { const saved = await saveHighlights(data.article, edits); setData((d) => ({ ...d, article: { ...d.article, blocks: saved.blocks, updatedAt: saved.updatedAt } })); } } : undefined} />
            <button type="button" dir="ltr" aria-pressed={hlOn} onClick={() => setHlOn((v) => !v)} className="fixed bottom-4 start-4 z-[60] rounded-xl border border-rule bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-elev">Highlight mode: {hlOn ? "ON" : "OFF"}</button>
          </>
        )}
    </PublicLayout>
  );
}
