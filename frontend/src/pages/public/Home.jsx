import { Link } from "react-router-dom";
import { FEATURED } from "../../config/featured.js";
import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../../components/ui/feedback.jsx";
import { ArticleCard, SectionCard } from "../../components/public/Cards.jsx";

const TONES = {
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
};

function QuoteCard({ label, item, tone, first }) {
  return (
    <figure className={`flex flex-col items-center rounded-2xl border border-white bg-white/80 px-6 py-9 text-center shadow-soft backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] sm:px-10 sm:py-11 lg:px-[19px] ${first ? "" : "lg:w-0 lg:min-w-full"}`}>
      <figcaption className={`rounded-full px-4 py-1 text-xs font-semibold ${TONES[tone]}`}>{label}</figcaption>
      <Text as="blockquote" force="arabic" className="mt-7 text-[1.65rem] leading-[2.2] sm:text-[2.1rem] lg:whitespace-nowrap lg:text-[2.4rem]">{item.text}</Text>
      <Text as="p" className="mt-4 max-w-3xl text-base text-mute sm:text-lg">{item.translation}</Text>
      <Text as="p" className="mt-6 rounded-full border border-rule bg-card px-4 py-1.5 text-sm text-bronze">{item.source}</Text>
    </figure>
  );
}

export default function Home() {
  const { t, contentLang } = useI18n();
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

      <section className="border-b border-accent/10 bg-accent/[0.05]">
       <div className="container-page py-14 sm:py-20">
        <Text as="p" force="arabic" className="mb-8 text-center text-3xl text-gold sm:text-4xl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <div className="mx-auto grid max-w-5xl gap-5 lg:w-fit lg:max-w-full">
          <QuoteCard label={t.home.ayat} item={FEATURED.ayat} tone="indigo" first />
          <QuoteCard label={t.home.hadith} item={FEATURED.hadith} tone="emerald" />
        </div>
      </div>
      </section>

      <section className="container-page pb-4 pt-14 sm:pt-20">
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
