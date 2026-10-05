import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, loadSection, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { mediaUrl } from "../../lib/media.js";
import { Text } from "../../components/ui/Text.jsx";
import { CardSkeletons, EmptyState, ErrorState, NotFoundState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";

function Group({ title, items, category, empty }) {
  const { t } = useI18n();
  return (
    <section className="mt-14">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-rule pb-3">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        <span className="text-sm text-mute">{items.length}</span>
      </div>
      {items.length === 0 ? <EmptyState>{empty || t.topic.noItems}</EmptyState> : (
        <div className="grid gap-5 sm:grid-cols-2">{items.map((a) => <ArticleCard key={a.id} article={a} category={category}  />)}</div>
      )}
    </section>
  );
}

/** /aqaid/:topicSlug, /masail/:topicSlug — Intro → Dalail → Radd. */
export default function TopicPage({ section }) {
  const { topicSlug } = useParams();
  const { t } = useI18n();
    const type = PATH_TYPE[section];

  const { data, error, loading, reload } = useAsync(async (signal) => {
    const cats = await loadSection(type, { signal });
    const category = cats.find((c) => c.topics.some((x) => x.slug === topicSlug));
    return { category, topic: category?.topics.find((x) => x.slug === topicSlug) };
  }, [type, topicSlug]);

  const topic = data?.topic;
  const arts = useAsync(
    (signal) => (topic ? publicApi.articles({ topicId: topic.id, limit: 100 }, signal) : []),
    [topic?.id]
  );
  useMeta({ title: topic?.title, description: topic?.intro, image: mediaUrl(topic?.coverKey) });

  if (loading && !data) return <div className="container-page py-16"><CardSkeletons count={2} /></div>;
  if (error && !data) return <div className="container-page py-16"><ErrorState error={error} onRetry={reload} /></div>;
  if (!topic) return <NotFoundState />;

  const list = arts.data || [];
  const by = (s) => list.filter((a) => (s ? a.section === s : !["dalail", "radd"].includes(a.section)));
  const cover = mediaUrl(topic.coverKey);
  const sectionLabel = section === "aqaid" ? t.nav.aqaid : t.nav.masail;

  return (
    <div className="pb-8">
      <div className="container-page max-w-5xl pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap gap-2 text-xs text-mute">
          <Link to={`/${section}`} className="hover:text-accent">{sectionLabel}</Link><span aria-hidden="true">/</span>
          <span>{data.category.name}</span>
        </nav>
        {cover && <div className="overflow-hidden rounded-2xl border border-rule"><img src={cover} alt="" className="aspect-[21/9] w-full object-cover" /></div>}
        <Text as="h1" className={`${cover ? "mt-8" : "mt-2"} font-display text-3xl font-bold leading-tight sm:text-5xl`}>{topic.title}</Text>

        {topic.intro && (
          <div className="mt-8 rounded-2xl border border-rule border-s-4 border-s-accent bg-card p-6 sm:p-8">
            <p className="eyebrow">{t.topic.intro}</p>
            <div className="reading mt-3">
              {topic.intro.split(/\n{2,}/).map((p, i) => <Text key={i} as="p" className="whitespace-pre-line">{p}</Text>)}
            </div>
          </div>
        )}


        {arts.loading && !arts.data ? <div className="mt-8"><CardSkeletons count={2} /></div> : arts.error ? <div className="mt-8"><ErrorState error={arts.error} onRetry={arts.reload} /></div> : (
          <>
            <Group title={t.topic.dalail} items={by("dalail")} category={data.category} />
            <Group title={t.topic.radd} items={by("radd")} category={data.category} />
            {by(null).length > 0 && <Group title={t.topic.more} items={by(null)} category={data.category} />}
          </>
        )}
      </div>
    </div>
  );
}
