import { Link } from "react-router-dom";
import { BRAND } from "../../config/env.js";
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
    <figure className="flex flex-col rounded-2xl border border-rule bg-card p-7 sm:p-9">
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

  const cats = data?.categories || [];
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const descOf = (type, fallback) => cats.find((c) => c.type === type)?.description || fallback;

  return (
    <>
      <section className="relative overflow-hidden border-b border-rule">
        <svg aria-hidden="true" viewBox="0 0 400 300" className="pointer-events-none absolute -bottom-10 end-[-60px] hidden w-[520px] text-gold/20 lg:block" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M40 300V190C40 110 110 50 200 50s160 60 160 140v110" /><path d="M200 50V20" /><path d="M80 300V200C80 135 130 90 200 90s120 45 120 110v100" />
        </svg>
        <div className="container-page relative py-16 text-center sm:py-24">
          <Text as="p" force="arabic" className="animate-fade-up text-3xl text-gold sm:text-4xl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          <p className="eyebrow mt-8 animate-fade-up [animation-delay:80ms]">{BRAND.tagline}</p>
          <h1 className="mx-auto mt-5 max-w-3xl animate-fade-up font-display text-4xl font-semibold leading-[1.15] [animation-delay:140ms] sm:text-6xl">{t.hero.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base text-mute [animation-delay:200ms] sm:text-lg">{t.hero.desc}</p>
          <div className="mt-9 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:260ms]">
            <Link to="/aqaid" className="btn-primary">{t.hero.cta1}<Icon name="arrow" size={16} className="rtl:rotate-180" /></Link>
            <Link to="/masail" className="btn-outline">{t.hero.cta2}</Link>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <QuoteCard label={t.home.ayat} item={pickFeatured(data?.articles, "ayat")} lang={lang} />
          <QuoteCard label={t.home.hadith} item={pickFeatured(data?.articles, "hadith")} lang={lang} />
        </div>
      </section>

      <section className="container-page pb-4">
        <SectionHeading eyebrow={t.home.sections} title={`${t.nav.aqaid} & ${t.nav.masail}`} />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionCard to="/aqaid" index="01" title={t.nav.aqaid} desc={descOf("aqeedah", t.home.aqaidDesc)} />
          <SectionCard to="/masail" index="02" title={t.nav.masail} desc={descOf("masail", t.home.masailDesc)} />
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <SectionHeading title={t.home.latest} />
        <div className="mt-10">
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
