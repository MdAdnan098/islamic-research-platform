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
  indigo: {
    card: "border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-card to-card dark:border-indigo-400/20 dark:from-indigo-500/10",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    bar: "from-indigo-500 to-violet-500",
  },
  emerald: {
    card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-card to-card dark:border-emerald-400/20 dark:from-emerald-500/10",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    bar: "from-emerald-500 to-teal-500",
  },
};

function QuoteCard({ label, item, tone }) {
  const c = TONES[tone];
  return (
    <figure className={`relative flex flex-col items-center overflow-hidden rounded-2xl border px-6 py-9 text-center shadow-soft sm:px-12 sm:py-12 ${c.card}`}>
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.bar}`} />
      <figcaption className={`rounded-full px-4 py-1 text-xs font-semibold ${c.pill}`}>{label}</figcaption>
      <Text as="blockquote" force="arabic" className="mt-7 text-[1.65rem] leading-[2.2] sm:text-[2.1rem] md:text-[2.4rem]">{item.text}</Text>
      <Text as="p" className="mt-4 max-w-3xl text-base text-mute sm:text-lg">{item.translation}</Text>
      <Text as="p" className="mt-6 border-t border-black/5 pt-4 text-sm text-bronze dark:border-white/10">{item.source}</Text>
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

      <section className="container-page py-14 sm:py-20">
        <Text as="p" force="arabic" className="mb-8 text-center text-3xl text-gold sm:text-4xl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <QuoteCard label={t.home.ayat} item={FEATURED.ayat} tone="indigo" />
          <QuoteCard label={t.home.hadith} item={FEATURED.hadith} tone="emerald" />
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
