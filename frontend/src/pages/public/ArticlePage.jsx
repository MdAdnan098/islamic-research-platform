import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { ArticleView } from "../../components/article/ArticleView.jsx";
import { Skeleton, ErrorState, NotFoundState } from "../../components/ui/feedback.jsx";

export default function ArticlePage() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync(async (signal) => {
    const { article, references } = await publicApi.article(slug, signal);
    const [cats, topics] = await Promise.all([
      publicApi.categories(signal).catch(() => []),
      article.topicId ? publicApi.topics(article.categoryId, signal).catch(() => []) : [],
    ]);
    const category = cats.find((c) => c.id === article.categoryId);
    const topic = topics.find((x) => x.id === article.topicId);
    const base = category ? `/${SECTION_PATH[category.type] || "aqaid"}` : null;
    const crumbs = [
      { label: t.nav.home, to: "/" },
      category && { label: category.type === "aqeedah" ? t.nav.aqaid : t.nav.masail, to: base },
      topic && base && { label: topic.title, to: `${base}/${topic.slug}` },
    ].filter(Boolean);
    return { article, references, crumbs, sectionBase: base ? base.slice(1) : null };
  }, [slug]);

  if (loading && !data) {
    return <div className="container-read space-y-4 py-16"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-4 w-1/3" /><Skeleton className="mt-8 h-40 w-full" /></div>;
  }
  if (error && !data) {
    return error.status === 404 ? <NotFoundState message={t.article.notFound} /> : <div className="container-read py-16"><ErrorState error={error} onRetry={reload} /></div>;
  }
  return <ArticleView {...data} />;
}
