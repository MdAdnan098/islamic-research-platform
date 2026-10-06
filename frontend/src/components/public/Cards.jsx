import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate, readMinutes } from "../../lib/format.js";
import { mediaUrl } from "../../lib/media.js";
import { pickVersion } from "../../lib/versions.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";

function snippet(article, lang) {
  if (article.excerpt) return article.excerpt;
  const b = (article.blocks || []).find((x) => x.type === "text" && x.text);
  const s = (b ? pickVersion(b.text, b.tr, article.language, lang) : "").replace(/\s+/g, " ").trim();
  return s.length > 170 ? `${s.slice(0, 170)}…` : s;
}

export function ArticleCard({ article, category }) {
  const { t, contentLang } = useI18n();
  const sectionLabel = category ? (category.type === "aqeedah" ? t.nav.aqaid : t.nav.masail) : null;
  const text = snippet(article, contentLang);
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
      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        {sectionLabel && <span className="eyebrow !text-sm">{sectionLabel}</span>}
        <Text as="h3" className="mt-2 line-clamp-2 min-h-[2.6em] font-display text-lg font-bold leading-snug sm:text-xl">{title}</Text>
        {text && <Text as="p" className="mt-2 line-clamp-2 text-base text-mute">{text}</Text>}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-mute">
          <span>{formatDate(article.publishedAt || article.createdAt)} · {readMinutes(article.blocks)} {t.article.minRead}</span>
          <Icon name="arrow" size={16} className="text-accent transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
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

/** Home page category card (Aqeedah / Masail): big centred name + quiet "Explore →". */
export function CategoryCard({ to, title, cta }) {
  return (
    <Link to={to} className="card-lift group flex min-h-[13rem] flex-col rounded-2xl border border-rule bg-card px-6 py-8 text-center sm:min-h-[15rem] sm:py-10">
      <div className="flex flex-1 items-center justify-center">
        <Text as="h3" className="text-[2.6rem] font-bold leading-tight sm:text-5xl">{title}</Text>
      </div>
      <span className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-medium text-accent">
        {cta} <Icon name="arrow" size={15} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </span>
    </Link>
  );
}
