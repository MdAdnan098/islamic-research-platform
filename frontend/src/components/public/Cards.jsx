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

/** Topic = "folder": compact folder-tab + tile with a folder icon; the topic name sits below the card. Sized for 3 per row on mobile. */
export function TopicCard({ topic, to }) {
  return (
    <Link to={to} className="group block min-w-0">
      <div className="relative pt-2 transition duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <span aria-hidden="true" className="absolute start-3 top-0 h-3 w-10 rounded-t-lg border border-b-0 border-rule bg-tint transition-colors group-hover:border-accent/40 sm:h-3.5 sm:w-12" />
        <div className="flex aspect-[5/4] w-full items-center justify-center rounded-xl border border-rule bg-tint shadow-elev transition duration-300 group-hover:border-accent/40 group-hover:shadow-soft">
          <Icon name="folder" size={34} className="text-accent/70 sm:h-10 sm:w-10" />
        </div>
      </div>
      <Text as="h3" className="mt-2 line-clamp-2 px-0.5 text-center font-display text-xs font-bold leading-snug sm:text-sm">{topic.title}</Text>
    </Link>
  );
}

/** Home page category card (Aqeedah & Manhaj / Fiqhi Masail): English title, small Urdu line beneath. */
export function CategoryCard({ to, title, subtitle }) {
  return (
    <Link to={to} className="cat-card card-lift group flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border border-rule bg-card px-6 py-6 text-center sm:min-h-[9.5rem] sm:px-8 sm:py-8">
      <h3 className="font-display text-[1.1rem] font-bold leading-tight text-accent sm:text-[1.75rem]">{title}</h3>
      <span aria-hidden="true" className="mt-2 h-0.5 w-8 rounded-full bg-accent/40 transition-all duration-300 group-hover:w-14 sm:mt-3 sm:w-10" />
      {subtitle && <Text as="p" force="urdu" className="mt-2 text-sm text-mute sm:mt-3 sm:text-base">{subtitle}</Text>}
    </Link>
  );
}
