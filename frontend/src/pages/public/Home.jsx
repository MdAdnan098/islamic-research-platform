import { Link } from "react-router-dom";
import { FEATURED_FALLBACK } from "../../config/featured.js";
import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../../components/ui/feedback.jsx";
import { ArticleCard, SectionCard } from "../../components/public/Cards.jsx";

function QuoteCard({ label, item, lang }) {
  return (
    <figure className="flex flex-col rounded-2xl border border-rule bg-card p-6 sm:p-9">
      <figcaption className="eyebrow">{label}</figcaption>
      <Text as="blockquote" force="arabic" className="mt-5 text-[1.65rem] leading-[2.2] sm:text-[1.9rem]">{item.text}</Text>
      {item.translation && <Text as="p" className="mt-4 text-sm text-mute">{item.translation[lang] || item.translation.roman}</Text>}
      <p className="mt-auto pt-5 text-sm text-bronze">{item.source}</p>
    </figure>
  );
}

/** First published quote block of the given kind wins; else the fallback. */
function pickFeatured(articles, kind) {
  for (const a of articles || []) {
    const b = (a.blocks || []).find((x) => x.type === "quote" && x.kind === kind && x.text);
    if (b) return { text: b.text, source: b.source || a.title };
  }
  return FEATURED_FALLBACK[kind];
}

export default function Home() {
  const { t, lang, contentLang } = useI18n();
  useMeta({});
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [categories, articles] = await Promise.all([
        publicApi.categories(signal),
        publicApi.articles({ language: contentLang, limit: 6 }, signal),
      ]);
      return { categories, articles };
    },
    [contentLang]
  );

  const [heroA, heroB] = t.hero.title.split(", ");
  const cats = data?.categories || [];
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const descOf = (type, fallback) => cats.find((c) => c.type === type)?.description || fallback;

  return (
    <>
      <section className="border-b border-rule">
        <div className="container-page py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl animate-fade-up text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl">
            {heroA}{heroB && <>, <span className="text-gold">{heroB}</span></>}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base text-mute [animation-delay:100ms] sm:text-lg">{t.hero.desc}</p>
          <div className="mt-9 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:180ms]">
            <Link to="/aqaid" className="btn-primary">{t.hero.cta1}<Icon name="arrow" size={16} className="rtl:rotate-180" /></Link>
            <Link to="/masail" className="btn-outline">{t.hero.cta2}</Link>
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20">
        <Text as="p" force="arabic" className="mb-8 text-center text-3xl text-gold sm:text-4xl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <div className="grid gap-5 md:grid-cols-2">
          <QuoteCard label={t.home.ayat} item={pickFeatured(data?.articles, "ayat")} lang={lang} />
          <QuoteCard label={t.home.hadith} item={pickFeatured(data?.articles, "hadith")} lang={lang} />
        </div>
      </section>

      <section className="container-page pb-4">
        <SectionHeading eyebrow={t.home.sections} title={`${t.nav.aqaid} & ${t.nav.masail}`} />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <SectionCard to="/aqaid" title={t.nav.aqaid} desc={descOf("aqeedah", t.home.aqaidDesc)} />
          <SectionCard to="/masail" title={t.nav.masail} desc={descOf("masail", t.home.masailDesc)} />
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <SectionHeading title={t.home.latest} />
        <div className="mt-8">
          {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data.articles.length === 0 ? (
            <EmptyState>{t.home.noPosts}</EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.articles.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
