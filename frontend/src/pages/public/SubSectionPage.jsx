import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, loadSectionArticles } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";

/** /aqaid/dalail, /aqaid/radd, /masail/dalail, /masail/radd — posts of one sub category. */
export default function SubSectionPage({ section, kind }) {
  const { t } = useI18n();
  const type = PATH_TYPE[section];
  const sectionLabel = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  const title = kind === "dalail" ? t.topic.dalail : t.topic.radd;
  useMeta({ title: `${title} · ${sectionLabel}` });
  const { data, error, loading, reload } = useAsync((signal) => loadSectionArticles(type, signal), [type]);
  const items = (data?.articles || []).filter((a) => a.section === kind);
  const catById = Object.fromEntries((data?.cats || []).map((c) => [c.id, c]));

  return (
    <div className="container-page py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap gap-2 text-xs text-mute">
        <Link to={`/${section}`} className="hover:text-accent">{sectionLabel}</Link><span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <div className="mt-10">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState>{t.topic.noItems}</EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} />)}
          </div>
        )}
      </div>
    </div>
  );
}
