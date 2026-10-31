import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, publicApi } from "../../services/public.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";
import { FolderSet, CountText } from "../../components/public/FolderGroups.jsx";
import { useIsAdmin } from "../../lib/adminHint.js";
import { togglePin } from "../../lib/pins.js";

/** /aqaid and /masail - two separate areas: root Folders, and General Articles (articles with no folder). */
export default function SectionPage({ section }) {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const type = PATH_TYPE[section];
  const title = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  useMeta({ title, description: `${title}: AthariTV ke folders aur mazameen, Quran, Sunnat aur salaf ke fahm ki roshni mein.` });

  const [total, setTotal] = useState(null);
  const folders = usePaged(async (page, signal) => {
    const r = await publicApi.folders({ type, page, limit: 24, pin: "all" }, signal);
    setTotal(r.total);
    return { items: r.folders, hasMore: r.hasMore };
  }, [type]);
  const pinFor = (f) => (isAdmin ? { active: f.pinAll, onToggle: async () => { if (await togglePin(f, "all")) folders.reload(); } } : undefined);
  const general = usePaged(async (page, signal) => {
    const r = await publicApi.articlePage({ type, general: 1, page, limit: 12 }, signal);
    return { items: r.articles, hasMore: r.hasMore };
  }, [type]);

  return (
    <div className="container-page py-12 sm:py-16">
      <p className="eyebrow cta-text">{t.home.sections}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>

      {folders.loading ? <div className="mt-10"><CardSkeletons count={3} /></div>
        : folders.error && !folders.items.length ? <div className="mt-10"><ErrorState error={folders.error} onRetry={folders.reload} /></div>
        : folders.items.length > 0 && (
          <>
            <hr className="mt-8 border-rule" />
            <div className="mt-6 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold sm:text-2xl">{t.home.folders}</h2>
              {typeof total === "number" && <CountText shown={folders.items.length} total={total} t={t} />}
            </div>
            <FolderSet folders={folders.items} t={t} hrefFor={(f) => `/${section}/${f.slug}`} pinFor={pinFor} />
            {folders.error && <div className="mt-6"><ErrorState error={folders.error} onRetry={folders.retryMore} /></div>}
            {folders.hasMore && <div className="mt-8 text-center"><button onClick={folders.loadMore} disabled={folders.more} className="btn-outline">{folders.more ? t.common.loading : t.home.loadMore}</button></div>}
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

      {!folders.loading && !general.loading && !folders.error && !folders.items.length && !general.items.length && (
        <div className="mt-10 rounded-xl border border-dashed border-rule px-6 py-10 text-center text-sm text-mute">{t.topic.noItems}</div>
      )}
    </div>
  );
}
