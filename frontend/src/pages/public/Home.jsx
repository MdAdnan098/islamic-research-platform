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

/** Faint calligraphy behind the hero — Quranic phrases, set in a calligraphic face, very low contrast. */
function HeroCalligraphy() {
  return (
    <div className="hero-calli" aria-hidden="true">
      <span style={{ top: "-4%", insetInlineStart: "-6%", fontSize: "clamp(4.5rem, 14vw, 10rem)", transform: "rotate(-5deg)" }}>ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ</span>
      <span style={{ bottom: "-6%", insetInlineEnd: "-4%", fontSize: "clamp(4rem, 13vw, 9rem)", transform: "rotate(-3deg)" }}>وَقُل رَّبِّ زِدْنِى عِلْمًا</span>
      <span style={{ top: "34%", insetInlineStart: "18%", fontSize: "clamp(3rem, 9vw, 6.5rem)", transform: "rotate(2deg)" }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>
    </div>
  );
}

function QuoteCard({ label, item }) {
  return (
    <figure className="flex h-full flex-col items-center rounded-2xl bg-soft px-6 py-9 text-center sm:px-8 sm:py-10">
      <figcaption className="rounded-full bg-card px-4 py-1 text-sm font-semibold text-accent">{label}</figcaption>
      <Text as="blockquote" force="arabic" className="home-arabic mt-6 text-[1.75rem] sm:text-[2.15rem]">{item.text}</Text>
      <Text as="p" className="home-urdu mt-4 max-w-3xl text-[1.2rem] text-ink sm:text-xl">{item.translation}</Text>
      <Text as="p" className="home-urdu mt-auto rounded-full bg-card px-4 py-1.5 text-base font-medium text-accent [margin-top:1.5rem]">{item.source}</Text>
    </figure>
  );
}

export default function Home() {
  const { t } = useI18n();
  useMeta({});
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [categories, articles] = await Promise.all([
        publicApi.categories(signal),
        publicApi.articles({ limit: 6 }, signal),
      ]);
      return { categories, articles };
    },
    []
  );

  const [heroA, heroB] = t.hero.title.split(", ");
  const cats = data?.categories || [];
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const descOf = (type, fallback) => cats.find((c) => c.type === type)?.description || fallback;

  return (
    <>
      <section className="hero-band">
        <HeroCalligraphy />
        <div className="container-page py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl animate-fade-up text-4xl font-bold leading-[1.15] sm:text-6xl">
            {heroA}{heroB && <>, <span className="text-accent">{heroB}</span></>}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-mute [animation-delay:100ms]">{t.hero.desc}</p>
          <div className="mt-9 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:180ms]">
            <Link to="/aqaid" className="btn-primary">{t.hero.cta1}<Icon name="arrow" size={16} className="rtl:rotate-180" /></Link>
            <Link to="/masail" className="btn-outline">{t.hero.cta2}</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
       <div className="container-page py-14 sm:py-20">
        <Text as="p" force="arabic" className="home-arabic mb-8 text-center text-[2rem] text-ink sm:text-[2.6rem]">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <div className="mx-auto grid max-w-5xl items-stretch gap-5 lg:grid-cols-2">
          <QuoteCard label={t.home.ayat} item={FEATURED.ayat} />
          <QuoteCard label={t.home.hadith} item={FEATURED.hadith} />
        </div>
      </div>
      </section>

      <section className="container-page pb-4 pt-14 sm:pt-20">
        <SectionHeading eyebrow={t.home.sections} title={`${t.nav.aqaid} & ${t.nav.masail}`} />
        <div className="mt-8 grid items-stretch gap-5 md:grid-cols-2">
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
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.articles.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
