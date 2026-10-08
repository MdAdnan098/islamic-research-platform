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
  // Posts that sit inside a visible topic ("folder") are shown only inside that topic; loose posts stay here.
  const topicIds = new Set((data || []).flatMap((c) => c.topics.map((tp) => tp.id)));
  const posts = (arts.data?.articles || []).filter((a) => !(a.topicId && topicIds.has(a.topicId)));
  const catById = Object.fromEntries((arts.data?.cats || []).map((c) => [c.id, c]));
  const topics = (data || []).flatMap((c) => c.topics);

  return (
    <div className="container-page py-12 sm:py-16">
      <p className="eyebrow">{t.home.sections}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>
      {!multi && data?.[0]?.description && <Text as="p" className="mt-5 max-w-2xl text-mute">{data[0].description}</Text>}

      {loading && !data ? (
        <div className="mt-10"><CardSkeletons count={3} /></div>
      ) : error && !data ? (
        <div className="mt-10"><ErrorState error={error} onRetry={reload} /></div>
      ) : topics.length > 0 && (
        <>
          <hr className="mt-8 border-rule" />
          <h2 className="mt-6 font-display text-xl font-bold sm:text-2xl">{t.topic.topics}</h2>
          {/* Folders stay at the top: 3 per row on mobile, a little larger and as many as fit on wider screens */}
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-4">
            {topics.map((tp) => <TopicCard key={tp.id} topic={tp} to={`/${section}/${tp.slug}`} />)}
          </div>
        </>
      )}

      {(arts.loading && !arts.data) || (loading && !data) ? (
        <div className="mt-10"><CardSkeletons count={2} /></div>
      ) : arts.error && !arts.data ? (
        <div className="mt-10"><ErrorState error={arts.error} onRetry={arts.reload} /></div>
      ) : posts.length > 0 && (
        <>
          <hr className="mt-10 border-rule" />
          <h2 className="mt-6 font-display text-xl font-bold sm:text-2xl">{t.topic.tahreer}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} />)}
          </div>
        </>
      )}
    </div>
  );
}

export function SectionRedirect() {
  const { section } = useParams();
  return <Navigate to={`/${section}`} replace />;
}
