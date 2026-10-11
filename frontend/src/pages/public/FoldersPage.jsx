import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { TopicCard } from "../../components/public/Cards.jsx";
import { folderPath } from "../../components/public/FoldersCard.jsx";

const SECTIONS = [["aqeedah", "aqaid"], ["masail", "masail"]];

/** /folders - every ROOT folder, grouped by section (Aqaid, Masail). Subfolders live inside their folder. */
export default function FoldersPage() {
  const { t } = useI18n();
  useMeta({ title: t.home.allFolders });
  const list = usePaged(async (page, signal) => {
    const r = await publicApi.folders({ page, limit: 24 }, signal);
    return { items: r.folders, hasMore: r.hasMore };
  }, []);

  const groups = SECTIONS.map(([type, key]) => ({ type, label: t.nav[key], items: list.items.filter((f) => f.section === type) })).filter((g) => g.items.length);
  const other = list.items.filter((f) => !SECTIONS.some(([type]) => type === f.section));

  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.home.allFolders}</h1>
      <div className="mt-8">
        {list.loading ? <CardSkeletons count={3} /> : list.error && !list.items.length ? <ErrorState error={list.error} onRetry={list.reload} /> : list.items.length === 0 ? (
          <EmptyState>{t.home.noFolders}</EmptyState>
        ) : (
          <>
            {[...groups, ...(other.length ? [{ type: "other", label: t.home.folders, items: other }] : [])].map((g) => (
              <section key={g.type} className="mb-10">
                <h2 className="font-display text-xl font-bold sm:text-2xl">{g.label}</h2>
                <hr className="mt-3 border-rule" />
                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-4">
                  {g.items.map((f) => <TopicCard key={f.id} topic={f} to={folderPath(f)} label={t.nav[f.section === "aqeedah" ? "aqaid" : "masail"]} />)}
                </div>
              </section>
            ))}
            {list.error && <ErrorState error={list.error} onRetry={list.retryMore} />}
            {list.hasMore && <div className="text-center"><button onClick={list.loadMore} disabled={list.more} className="btn-outline">{list.more ? t.common.loading : t.home.loadMore}</button></div>}
          </>
        )}
      </div>
    </div>
  );
}
