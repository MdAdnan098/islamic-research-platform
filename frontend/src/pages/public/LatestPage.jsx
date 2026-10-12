import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";

/** /latest - ONE combined newest-first feed of every published article (all sections, all folder depths), server-paged. */
export default function LatestPage() {
  const { t } = useI18n();
  useMeta({ title: t.home.latest, description: "AthariTV ke sabse naye mazameen - Aqaid aur Masail, tarteeb se naye pehle." });
  const list = usePaged(async (page, signal) => {
    const r = await publicApi.latest({ page, limit: 12 }, signal);
    return { items: r.articles, hasMore: r.hasMore };
  }, []);

  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.home.latest}</h1>
      <div className="mt-10">
        {list.loading ? <CardSkeletons /> : list.error && !list.items.length ? <ErrorState error={list.error} onRetry={list.reload} /> : list.items.length === 0 ? (
          <EmptyState>{t.home.noPosts}</EmptyState>
        ) : (
          <>
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((a) => <ArticleCard key={a.id} article={a} showPath />)}
            </div>
            {list.error && <div className="mt-6"><ErrorState error={list.error} onRetry={list.retryMore} /></div>}
            {list.hasMore && <div className="mt-8 text-center"><button onClick={list.loadMore} disabled={list.more} className="btn-outline">{list.more ? t.common.loading : t.home.loadMore}</button></div>}
          </>
        )}
      </div>
    </div>
  );
}
