import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { pickVersion } from "../../lib/versions.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";

export function ArticleCard({ article, category, showCategory = false }) {
  const { t, contentLang } = useI18n();
  const label = showCategory && category ? (category.type === "aqeedah" ? t.nav.aqaid : t.nav.masail) : null;
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
        <div className="min-w-0">
          <Text as="h3" className="line-clamp-2 font-display text-lg font-bold leading-snug sm:text-xl">{title}</Text>
          {label && <span className="mt-2 inline-block text-xs text-mute">{label}</span>}
        </div>
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

/** Home page category card (Aqaid / Masail): plain card + shadow, with a fixed-gold Islamic ornament (colours do not follow the theme). */
const GOLD = "194 162 103";
function Star({ size, filled = false, className = "", style }) {
  const p = filled ? { fill: `rgb(${GOLD})` } : { fill: "none", stroke: `rgb(${GOLD})`, strokeWidth: 1.2 };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true" {...p}>
      <rect x="18" y="18" width="64" height="64" />
      <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
    </svg>
  );
}

export function CategoryCard({ to, title, cta }) {
  return (
    <Link to={to} className="card-lift group relative flex min-h-[13rem] flex-col overflow-hidden rounded-2xl border border-rule bg-card px-6 py-8 text-center sm:min-h-[15rem] sm:py-10">
      {/* fine inner frame + faint eight-point star (rub el hizb) behind the title */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-2.5 rounded-xl border" style={{ borderColor: `rgb(${GOLD} / .38)` }} />
      <Star size={170} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.11 }} />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <Text as="h3" className="text-[2.6rem] font-bold leading-tight text-accent sm:text-5xl">{title}</Text>
        <span aria-hidden="true" className="mt-4 flex items-center gap-2.5">
          <span className="h-px w-10" style={{ background: `rgb(${GOLD} / .7)` }} />
          <Star size={14} filled />
          <span className="h-px w-10" style={{ background: `rgb(${GOLD} / .7)` }} />
        </span>
      </div>
      <span className="relative mt-6 inline-flex items-center justify-center gap-2 self-center rounded-full border border-accent/30 px-5 py-1.5 text-sm font-medium text-accent transition group-hover:bg-accent group-hover:text-white">
        {cta} <Icon name="arrow" size={15} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </span>
    </Link>
  );
}
