import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { pickVersion } from "../../lib/versions.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";

const sectionLabel = (t, type) => (type === "aqeedah" ? t.nav.aqaid : type === "masail" ? t.nav.masail : null);

/** Subtle breadcrumb text: "Aqaid › Folder › Subfolder" (section, then visible folders). */
export function trailLabel(t, article) {
  return [sectionLabel(t, article.section), ...(article.folders || []).map((f) => f.title)].filter(Boolean).join(" › ");
}

export function ArticleCard({ article, category, showCategory = false, showPath = false }) {
  const { t, contentLang } = useI18n();
  const label = showPath ? trailLabel(t, article) : showCategory && category ? sectionLabel(t, category.type) : null;
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
          {label && <Text as="span" className="mt-2 block text-xs text-mute">{label}</Text>}
        </div>
      </div>
    </Link>
  );
}

/** Topic = "folder": compact folder-tab + tile with a folder icon; the topic name sits below the card. Sized for 3 per row on mobile. */
export function TopicCard({ topic, to, label }) {
  return (
    <Link to={to} className="group block min-w-0">
      <div className="relative pt-2 transition duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <span aria-hidden="true" className="absolute start-3 top-0 h-3 w-10 rounded-t-lg border border-b-0 border-rule bg-tint transition-colors group-hover:border-accent/40 sm:h-3.5 sm:w-12" />
        <div className="flex aspect-[5/4] w-full items-center justify-center rounded-xl border border-rule bg-tint shadow-elev transition duration-300 group-hover:border-accent/40 group-hover:shadow-soft">
          <Icon name="folder" size={34} className="text-accent/70 sm:h-10 sm:w-10" />
        </div>
      </div>
      <Text as="h3" className="mt-2 line-clamp-2 px-0.5 text-center font-display text-xs font-bold leading-snug sm:text-sm">{topic.title}</Text>
      {label && <span className="mt-0.5 block text-center text-[11px] text-mute">{label}</span>}
    </Link>
  );
}

/** Compact folder tile used inside the single homepage "Folders" card: icon, name, subtle section label. */
export function FolderTile({ folder, to }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3 rounded-xl border border-rule bg-tint px-3 py-3 transition hover:border-accent/40">
      <Icon name="folder" size={26} className="shrink-0 text-accent/80" />
      <div className="min-w-0">
        <Text as="h3" className="line-clamp-2 font-display text-sm font-bold leading-snug sm:text-base">{folder.title}</Text>
        {sectionLabel(t, folder.section) && <span className="block text-[11px] text-mute">{sectionLabel(t, folder.section)}</span>}
      </div>
    </Link>
  );
}

/** One corner flourish. Drawn for the top-left corner; the other three corners mirror it with CSS flips. */
function CornerOrnament({ className = "" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={`pointer-events-none absolute h-[13%] w-auto min-h-5 text-[#9b9b9b] ${className}`} style={{ aspectRatio: "1 / 1" }}>
      <path d="M3 45V19M3 3h26" />
      <path d="M3 3c0 8 6 13 13 13 6 0 10-4 10-8.5S22 3 18.5 5.5 14.5 12 19 12.5" />
      <path d="M9 24c0 6 4 9 8 9" />
      <path d="M24 9c5 0 8 3 8 7" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Home page card for Aqaid / Masail: coloured Arabic title on top, English title below, flourish in all four corners.
 *  Same proportions, shadow and corner design as the reference app cards; two fit side by side on a phone. */
export function CategoryCard({ to, arabic, title, color }) {
  return (
    <Link to={to} className="cat-card card-lift group relative flex aspect-[494/366] min-w-0 flex-col items-center justify-center rounded-md border border-rule bg-card px-3 text-center shadow-[0_2px_8px_rgb(0_0_0/0.16)]">
      <CornerOrnament className="start-1.5 top-1.5" />
      <CornerOrnament className="end-1.5 top-1.5 -scale-x-100" />
      <CornerOrnament className="bottom-1.5 start-1.5 -scale-y-100" />
      <CornerOrnament className="bottom-1.5 end-1.5 -scale-100" />
      <span dir="rtl" lang="ar" className="cat-arabic font-bold" style={{ color, fontFamily: "'Aref Ruqaa', 'FS Urdu', 'FS Arabic', serif" }}>{arabic}</span>
      <span className="mt-1 font-sans text-[1.05rem] font-medium leading-tight text-ink sm:mt-2 sm:text-xl">{title}</span>
    </Link>
  );
}
