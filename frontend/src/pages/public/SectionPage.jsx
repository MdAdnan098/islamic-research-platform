import { Navigate, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, loadSection, loadSectionArticles } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { CardSkeletons, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard, TopicCard } from "../../components/public/Cards.jsx";

/** /aqaid and /masail — Category → Topics. */
export default function SectionPage({ section }) {
  const { t } = useI18n();
  const type = PATH_TYPE[section];
  const title = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  useMeta({ title });
  const { data, error, loading, reload } = useAsync((signal) => loadSection(type, { signal }), [type]);
  const multi = (data?.length || 0) > 1;
  const arts = useAsync((signal) => loadSectionArticles(type, signal), [type]);
  // every published post of this section (general, dalail and radd alike) — the dalail/radd cards live inside the post itself
  const posts = arts.data?.articles || [];
  const catById = Object.fromEntries((arts.data?.cats || []).map((c) => [c.id, c]));
  const hasTopics = !!data?.some((c) => c.topics.length);

  return (
    <div className="container-page py-12 sm:py-16">
      <p className="eyebrow">{t.home.sections}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>
      {!multi && data?.[0]?.description && <Text as="p" className="mt-5 max-w-2xl text-mute">{data[0].description}</Text>}

      {arts.loading && !arts.data ? (
        <div className="mt-14"><CardSkeletons count={2} /></div>
      ) : arts.error && !arts.data ? (
        <div className="mt-14"><ErrorState error={arts.error} onRetry={arts.reload} /></div>
      ) : posts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-6 border-b border-rule pb-3 font-display text-2xl font-bold sm:text-3xl">{t.topic.posts}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} />)}
          </div>
        </section>
      )}

      {loading && !data ? null : error && !data ? (
        <div className="mt-14"><ErrorState error={error} onRetry={reload} /></div>
      ) : hasTopics && (
        <div className="mt-14 space-y-14">
          {data.filter((c) => c.topics.length).map((c) => (
            <section key={c.id}>
              {multi && (
                <div className="mb-6">
                  <Text as="h2" className="font-display text-2xl font-bold">{c.name}</Text>
                  {c.description && <Text as="p" className="mt-1 text-sm text-mute">{c.description}</Text>}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {c.topics.map((tp) => <TopicCard key={tp.id} topic={tp} to={`/${section}/${tp.slug}`} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionRedirect() {
  const { section } = useParams();
  return <Navigate to={`/${section}`} replace />;
}
