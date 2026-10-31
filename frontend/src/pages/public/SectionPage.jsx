import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard, TopicCard } from "../../components/public/Cards.jsx";
import { useIsAdmin } from "../../lib/adminHint.js";
import { togglePin } from "../../lib/pins.js";

/** /aqaid and /masail - two separate areas: root Folders, and General Articles (articles with no folder). */
export default function SectionPage({ section }) {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const type = PATH_TYPE[section];
  const title = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  useMeta({ title, description: `${title}: AthariTV ke folders aur mazameen, Quran, Sunnat aur salaf ke fahm ki roshni mein.` });

  const folders = useAsync(async (signal) => {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const r = await publicApi.folders({ type, page, limit: 100, pin: "section" }, signal);
      all.push(...r.folders);
      if (!r.hasMore) break;
    }
    return all;
  }, [type]);
  const general = usePaged(async (page, signal) => {
    const r = await publicApi.articlePage({ type, general: 1, page, limit: 12 }, signal);
    return { items: r.articles, hasMore: r.hasMore };
  }, [type]);

  return (
    <div className="container-page py-12 sm:py-16">
      <p className="eyebrow cta-text">{t.home.sections}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>

      {folders.loading && !folders.data ? <div className="mt-10"><CardSkeletons count={3} /></div>
        : folders.error && !folders.data ? <div className="mt-10"><ErrorState error={folders.error} onRetry={folders.reload} /></div>
        : folders.data.length > 0 && (
          <>
            <hr className="mt-8 border-rule" />
            <h2 className="mt-6 font-display text-xl font-bold sm:text-2xl">{t.home.folders}</h2>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-4">
              {folders.data.map((f) => <TopicCard key={f.id} topic={f} to={`/${section}/${f.slug}`} pin={isAdmin ? { active: f.pinSection, onToggle: async () => { if (await togglePin(f, "section")) folders.reload(); } } : undefined} />)}
            </div>
          </>
        )}

      {general.loading ? <div className="mt-10"><CardSkeletons count={2} /></div>
        : general.error && !general.items.length ? <div className="mt-10"><ErrorState error={general.error} onRetry={general.reload} /></div>
        : general.items.length > 0 && (
          <>
            <hr className="mt-10 border-rule" />
            <h2 className="mt-6 font-display text-xl font-bold sm:text-2xl">{t.home.generalArticles}</h2>
            <div className="mt-5 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {general.items.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
            {general.hasMore && <div className="mt-8 text-center"><button onClick={general.loadMore} disabled={general.more} className="btn-outline">{general.more ? t.common.loading : t.home.loadMore}</button></div>}
          </>
        )}

      {!folders.loading && !general.loading && !folders.error && !folders.data?.length && !general.items.length && (
        <div className="mt-10 rounded-xl border border-dashed border-rule px-6 py-10 text-center text-sm text-mute">{t.topic.noItems}</div>
      )}
    </div>
  );
}
