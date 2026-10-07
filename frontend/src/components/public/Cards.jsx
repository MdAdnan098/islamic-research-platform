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
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
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
      <div className="aspect-[16/9] w-full overflow-hidden bg-tint">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
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

/** Home page category card (Aqeedah & Manhaj / Fiqhi Masail): English title, small Urdu line beneath. */
export function CategoryCard({ to, title, subtitle }) {
  return (
    <Link to={to} className="cat-card card-lift group flex min-h-[10rem] flex-col items-center justify-center rounded-2xl border border-rule bg-card px-6 py-9 text-center sm:min-h-[12rem]">
      <h3 className="font-display text-[2rem] font-bold leading-tight text-accent sm:text-[2.5rem]">{title}</h3>
      <span aria-hidden="true" className="mt-3 h-0.5 w-10 rounded-full bg-accent/40 transition-all duration-300 group-hover:w-16" />
      {subtitle && <Text as="p" force="urdu" className="mt-3 text-base text-mute sm:text-lg">{subtitle}</Text>}
    </Link>
  );
}
