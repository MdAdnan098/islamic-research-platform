import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH, publicApi } from "../../services/public.js";
import { usePaged } from "../../lib/usePaged.js";
import { useMeta } from "../../lib/useMeta.js";
import { Icon } from "../../components/ui/icons.jsx";
import { Text } from "../../components/ui/Text.jsx";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { ArticleCard } from "../../components/public/Cards.jsx";

/** /search?q= - public search over published articles (title, body, folders, references). All matching happens on the server. */
export default function SearchPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useMeta({ title: q ? `${t.search.title}: ${q}` : t.search.title });

  const [folders, setFolders] = useState([]);
  const list = usePaged(async (page, signal) => {
    if (q.length < 2) { setFolders([]); return { items: [], hasMore: false }; }
    const r = await publicApi.search({ q, page, limit: 12 }, signal);
    if (page === 1) setFolders(r.folders || []);
    return { items: r.articles, hasMore: r.hasMore };
  }, [q]);

  const submit = (e) => { e.preventDefault(); const v = text.trim(); if (v) setParams({ q: v }); };

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.search.title}</h1>
      <form onSubmit={submit} role="search" className="mt-6 flex gap-2">
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} dir="auto" placeholder={t.search.placeholder} aria-label={t.search.title} autoFocus={!q}
          className="min-w-0 flex-1 rounded-full border border-rule bg-field px-5 py-2.5 text-base text-ink placeholder:text-mute focus:border-accent focus:outline-none" />
        <button type="submit" className="btn-primary"><Icon name="search" size={18} /><span className="hidden sm:inline">{t.search.button}</span></button>
      </form>

      <div className="mt-8">
        {q.length === 0 ? <EmptyState>{t.search.empty}</EmptyState>
          : q.length < 2 ? <EmptyState>{t.search.short}</EmptyState>
          : list.loading ? <CardSkeletons count={3} />
          : list.error && !list.items.length ? <ErrorState error={{ message: t.search.error }} onRetry={list.reload} />
          : list.items.length === 0 && folders.length === 0 ? <EmptyState>{t.search.noResults}</EmptyState>
          : (
            <>
              {folders.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-3 font-display text-lg font-bold">{t.search.folders}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {folders.map((f) => (
                      <Link key={f.id} to={`/${SECTION_PATH[f.section] || "aqaid"}/${f.slug}`} className="flex items-center gap-3 rounded-xl border border-rule bg-card px-4 py-3 hover:border-accent/40">
                        <Icon name="folder" size={22} className="shrink-0 text-accent/80" />
                        <div className="min-w-0"><Text as="p" className="line-clamp-2 font-display font-bold">{f.title}</Text>
                          <Text as="span" className="block text-xs text-mute">{[t.nav[f.section === "aqeedah" ? "aqaid" : "masail"], ...(f.folders || []).map((x) => x.title)].join(" › ")}</Text></div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              {list.items.length > 0 && <h2 className="mb-3 font-display text-lg font-bold">{t.search.articles}</h2>}
              <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.items.map((a) => <ArticleCard key={a.id} article={a} showPath />)}</div>
              {list.error && <div className="mt-6"><ErrorState error={{ message: t.search.error }} onRetry={list.retryMore} /></div>}
              {list.hasMore && <div className="mt-8 text-center"><button onClick={list.loadMore} disabled={list.more} className="btn-outline">{list.more ? t.common.loading : t.home.loadMore}</button></div>}
            </>
          )}
      </div>
    </div>
  );
}
