import { Link } from "react-router-dom";
import { FEATURED } from "../../config/featured.js";
import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../../components/ui/feedback.jsx";
import { ArticleCard, CategoryCard } from "../../components/public/Cards.jsx";
import { FoldersCard } from "../../components/public/FoldersCard.jsx";
import { LiveSessionsSection } from "../../components/public/LiveSessions.jsx";
import { CoursesSection } from "../../components/public/CourseCards.jsx";
import { HeroBanner } from "../../components/public/HeroBanner.jsx";
import { HeroImage } from "../../components/public/HeroImage.jsx";
import { HERO_VARIANT } from "../../config/hero.js";

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
    <figure className="home-quote card-lift flex h-full flex-col items-center rounded-2xl border border-rule bg-soft px-3 py-5 text-center sm:px-8 sm:py-9">
      <figcaption className="quote-pill rounded-full bg-card px-3.5 py-0.5 text-xs font-semibold text-accent sm:px-4 sm:py-1 sm:text-sm">{label}</figcaption>
      <Text as="blockquote" force="arabic" className="home-arabic mt-3 sm:mt-5">{item.text}</Text>
      <Text as="p" className="home-urdu mt-2 max-w-3xl text-[0.92rem] text-mute sm:mt-3 sm:text-[1.05rem]">{item.translation}</Text>
      <div className="mt-auto pt-4 sm:pt-5">
        <Text as="p" className="quote-pill-gold quote-source rounded-full bg-card px-3.5 py-0.5 text-[0.8rem] font-medium text-accent sm:px-4 sm:py-1 sm:text-sm">{item.source}</Text>
      </div>
    </figure>
  );
}

/** OLD hero (kept so the design can be switched back: set HERO_VARIANT = "classic" in config/hero.js). */
function ClassicHero({ t, heroA, heroB }) {
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
    </>
  );
}

export default function Home() {
  const { t } = useI18n();
  useMeta({});
  const { data, error, loading, reload } = useAsync(
    // ONE request for the whole homepage: categories, latest posts (exactly HOME_LATEST_LIMIT, set server-side) and folders.
    async (signal) => {
      const h = await publicApi.home(signal);
      return { categories: h.categories, articles: h.recentArticles, folders: h.folders };
    },
    []
  );

  const [heroA, heroB] = t.hero.title.split(", ");
  const cats = data?.categories || [];
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));

  return (
    <>
      {HERO_VARIANT === "classic" ? <ClassicHero t={t} heroA={heroA} heroB={heroB} /> : HERO_VARIANT === "banner" ? <HeroBanner /> : <HeroImage />}

      <section className="border-b border-rule">
       <div className="mx-auto w-full max-w-6xl px-2 py-10 sm:px-8 sm:py-20">
        <Text as="p" force="arabic" className="home-arabic mb-6 text-center text-[2rem] text-ink sm:mb-8 sm:text-[2.6rem]">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <div className="mx-auto grid max-w-5xl items-stretch gap-4 sm:gap-5 lg:grid-cols-2">
          <QuoteCard label={t.home.ayat} item={FEATURED.ayat} />
          <QuoteCard label={t.home.hadith} item={FEATURED.hadith} />
        </div>
      </div>
      </section>

      <section className="pb-4 pt-14 sm:pt-20">
        <div className="container-page">
          <SectionHeading eyebrow={t.home.sections} title={`${t.nav.aqaid} & ${t.nav.masail}`} />
        </div>
        {/* Always two cards side by side (Aqaid first, then Masail) — phone gap ~8px at the sides, ~16px between */}
        <div className="mx-auto mt-6 grid w-full max-w-[36rem] grid-cols-2 gap-4 px-2 sm:mt-8 sm:px-0">
          <CategoryCard to="/aqaid" arabic="عقائد" title="Aqaid" color="#F5B000" />
          <CategoryCard to="/masail" arabic="مسائل" title="Masail" color="#C0492F" />
        </div>
      </section>

      <FoldersCard folders={data?.folders} loading={loading} error={error} onRetry={reload} />

      <section className="container-page py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading title={t.home.latest} />
          <Link to="/latest" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-4 py-1.5 text-sm font-medium text-accent transition hover:bg-btn hover:text-white">
            {t.home.viewAll} <Icon name="arrow" size={15} className="rtl:rotate-180" />
          </Link>
        </div>
        <div className="mt-8">
          {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data.articles.length === 0 ? (
            <EmptyState>{t.home.noPosts}</EmptyState>
          ) : (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.articles.map((a) => <ArticleCard key={a.id} article={a} category={catById[a.categoryId]} showPath />)}
            </div>
          )}
        </div>
      </section>

      <LiveSessionsSection />
      <CoursesSection />
    </>
  );
}
