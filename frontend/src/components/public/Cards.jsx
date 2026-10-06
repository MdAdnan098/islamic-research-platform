import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { pickVersion } from "../../lib/versions.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";

export function ArticleCard({ article, category }) {
  const { contentLang } = useI18n();
  const cover = mediaUrl(article.coverKey);
  const title = pickVersion(article.title, article.titleTr, article.language, contentLang);
  return (
    <Link to={`/article/${article.slug}`} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-3">
      {/* Cover image on top of the card; corners rounded to sit inside the card's own radius */}
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-tint">
        {cover && (
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        )}
      </div>
      <div className="flex flex-1 items-start px-3 pb-3 pt-4">
        <Text as="h3" className="line-clamp-2 font-display text-lg font-bold leading-snug sm:text-xl">{title}</Text>
      </div>
    </Link>
  );
}

export function TopicCard({ topic, to }) {
  const cover = mediaUrl(topic.coverKey);
  return (
    <Link to={to} className="card-lift group flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="aspect-[16/9] w-full bg-tint">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-tint" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Text as="h3" className="line-clamp-2 min-h-[2.6em] font-display text-xl font-bold leading-snug">{topic.title}</Text>
        <Text as="p" className="mt-2 line-clamp-2 min-h-[3.4em] text-base text-mute">{topic.intro || "\u00A0"}</Text>
        <Icon name="arrow" size={16} className="mt-auto pt-4 text-accent transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </div>
    </Link>
  );
}

export function SectionCard({ to, title, desc }) {
  return (
    <Link to={to} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-7 sm:p-8">
      <h3 className="text-2xl font-bold sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-sm text-base text-mute">{desc}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-accent">
        {title} <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </span>
    </Link>
  );
}

/** Home page category card (Aqaid / Masail): decorative centred name + quiet "Explore →". */
export function CategoryCard({ to, title, cta }) {
  return (
    <Link to={to} className="card-lift group relative flex min-h-[13rem] flex-col overflow-hidden rounded-2xl border border-rule bg-gradient-to-b from-accent/10 via-card to-card px-6 py-8 text-center sm:min-h-[15rem] sm:py-10">
      {/* soft decorative ring in the corner */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[14px] border-accent/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full border-[12px] border-accent/10" />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-accent/70" />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <Text as="h3" className="text-[2.6rem] font-bold leading-tight text-accent sm:text-5xl">{title}</Text>
        <span aria-hidden="true" className="mt-4 flex items-center gap-2 text-accent/70">
          <span className="h-px w-10 bg-accent/40" />
          <span className="h-2 w-2 rotate-45 bg-accent/70" />
          <span className="h-px w-10 bg-accent/40" />
        </span>
      </div>
      <span className="relative mt-6 inline-flex items-center justify-center gap-2 self-center rounded-full border border-accent/30 px-5 py-1.5 text-sm font-medium text-accent transition group-hover:bg-accent group-hover:text-white">
        {cta} <Icon name="arrow" size={15} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </span>
    </Link>
  );
}
