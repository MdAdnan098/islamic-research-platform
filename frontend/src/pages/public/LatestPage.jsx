import { useI18n } from "../../i18n/index.jsx";
import { loadAllArticles } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";

/** /latest — every published post (Aqaid and Masail together), each card tagged with its category. */
export default function LatestPage() {
  const { t } = useI18n();
  useMeta({ title: t.home.latest });
  const { data, error, loading, reload } = useAsync((signal) => loadAllArticles(signal), []);
  const posts = data?.articles || [];
  const catById = Object.fromEntries((data?.cats || []).map((c) => [c.id, c]));

  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.home.latest}</h1>
      <div className="mt-10">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : posts.length === 0 ? (
          <EmptyState>{t.home.noPosts}</EmptyState>
        ) : (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} showCategory />)}
          </div>
        )}
      </div>
    </div>
  );
}
