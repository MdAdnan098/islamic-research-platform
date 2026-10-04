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
  return (
    <Link to={`/article/${article.slug}`} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-6">
      <div className="flex items-center justify-between gap-3 text-xs text-mute">
        <span className="eyebrow !text-xs">{sectionLabel || "\u00A0"}</span>
      </div>
      <Text as="h3" className="mt-3 font-display text-lg font-semibold leading-snug sm:text-xl">{pickVersion(article.title, article.titleTr, article.language, contentLang)}</Text>
      {text && <Text as="p" className="mt-3 line-clamp-3 text-sm text-mute">{text}</Text>}
      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-mute">
        <span>{formatDate(article.publishedAt || article.createdAt)} · {readMinutes(article.blocks)} {t.article.minRead}</span>
        <Icon name="arrow" size={16} className="text-bronze transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
      </div>
    </Link>
  );
}

export function TopicCard({ topic, to }) {
  const cover = mediaUrl(topic.coverKey);
  return (
    <Link to={to} className="card-lift group flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="aspect-[16/9] w-full bg-rule/40">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-rule/40" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Text as="h3" className="font-display text-xl font-semibold leading-snug">{topic.title}</Text>
        {topic.intro && <Text as="p" className="mt-2 line-clamp-2 text-sm text-mute">{topic.intro}</Text>}
        <Icon name="arrow" size={16} className="mt-auto pt-0 text-bronze transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </div>
    </Link>
  );
}

export function SectionCard({ to, title, desc }) {
  return (
    <Link to={to} className="card-lift group flex flex-col rounded-2xl border border-rule bg-card p-7 sm:p-8">
      <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-sm text-mute">{desc}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-bronze">
        {title} <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </span>
    </Link>
  );
}
