import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { mediaUrl } from "../../lib/media.js";
import { Text } from "../../components/ui/Text.jsx";
import { CardSkeletons, ErrorState, NotFoundState } from "../../components/ui/feedback.jsx";
import { ArticleCard, TopicCard } from "../../components/public/Cards.jsx";

/** /aqaid/:slug, /masail/:slug - a root folder OR a subfolder: breadcrumb, intro, immediate subfolders, direct articles. */
export default function TopicPage({ section }) {
  const { topicSlug } = useParams();
  const { t } = useI18n();
  const type = PATH_TYPE[section];

  const { data, error, loading, reload } = useAsync((signal) => publicApi.folder(type, topicSlug, signal), [type, topicSlug]);
  const topic = data?.folder;
  const arts = usePaged(async (page, signal) => {
    if (!topic) return { items: [], hasMore: false };
    const r = await publicApi.articlePage({ topicId: topic.id, page, limit: 12 }, signal);
    return { items: r.articles, hasMore: r.hasMore };
  }, [topic?.id]);
  useMeta({ title: topic?.title, description: topic?.intro, image: mediaUrl(topic?.coverKey) });

  if (loading && !data) return <div className="container-page py-16"><CardSkeletons count={2} /></div>;
  if (error && !data) return error.status === 404 ? <NotFoundState /> : <div className="container-page py-16"><ErrorState error={error} onRetry={reload} /></div>;
  if (!topic) return <NotFoundState />;

  const cover = mediaUrl(topic.coverKey);
  const sectionLabel = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  const children = data.children || [];
  const empty = !arts.loading && !arts.items.length && !children.length;

  return (
    <div className="pb-8">
      <div className="container-page max-w-5xl pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
          <Link to={`/${section}`} className="hover:text-accent">{sectionLabel}</Link>
          {data.ancestors.map((a) => (
            <span key={a.slug} className="flex items-center gap-2"><span aria-hidden="true">/</span><Link to={`/${section}/${a.slug}`} className="hover:text-accent"><Text as="span">{a.title}</Text></Link></span>
          ))}
          <span className="flex items-center gap-2"><span aria-hidden="true">/</span><Text as="span">{topic.title}</Text></span>
        </nav>
        {cover && <div className="overflow-hidden rounded-2xl border border-rule"><img src={cover} alt="" className="aspect-[21/9] w-full object-cover" /></div>}
        <Text as="h1" className={`${cover ? "mt-8" : "mt-2"} font-display text-3xl font-bold leading-tight sm:text-5xl`}>{topic.title}</Text>

        {topic.intro && (
          <div className="mt-8 rounded-2xl border border-rule border-s-4 border-s-accent bg-card p-6 sm:p-8">
            <p className="eyebrow">{t.topic.intro}</p>
            <div className="reading mt-3">{topic.intro.split(/\n{2,}/).map((p, i) => <Text key={i} as="p" className="whitespace-pre-line">{p}</Text>)}</div>
          </div>
        )}

        {children.length > 0 && (
          <>
            <h2 className="mt-10 font-display text-xl font-bold sm:text-2xl">{t.home.subfolders}</h2>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-4">
              {children.map((c) => <TopicCard key={c.id} topic={c} to={`/${section}/${c.slug}`} />)}
            </div>
          </>
        )}

        {arts.loading ? <div className="mt-8"><CardSkeletons count={2} /></div> : arts.error && !arts.items.length ? <div className="mt-8"><ErrorState error={arts.error} onRetry={arts.reload} /></div> : arts.items.length > 0 && (
          <>
            {children.length > 0 && <h2 className="mt-10 font-display text-xl font-bold sm:text-2xl">{t.topic.tahreer}</h2>}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">{arts.items.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
            {arts.hasMore && <div className="mt-8 text-center"><button onClick={arts.loadMore} disabled={arts.more} className="btn-outline">{arts.more ? t.common.loading : t.home.loadMore}</button></div>}
          </>
        )}
        {empty && <div className="mt-10 rounded-xl border border-dashed border-rule px-6 py-10 text-center text-sm text-mute">{t.home.emptyFolder}</div>}
      </div>
    </div>
  );
}
