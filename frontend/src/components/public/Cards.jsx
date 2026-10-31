import { Link } from "react-router-dom";
import { FolderIcon } from "../ui/FolderIcon.jsx";
import { PinButton } from "./PinButton.jsx";
import { useI18n } from "../../i18n/index.jsx";
import { mediaUrl } from "../../lib/media.js";
import { pickVersion } from "../../lib/versions.js";
import { Text } from "../ui/Text.jsx";
import { Icon } from "../ui/icons.jsx";
import { ORNAMENTS } from "../../assets/cornerOrnaments.js";

const sectionLabel = (t, type) => (type === "aqeedah" ? t.nav.aqaid : type === "masail" ? t.nav.masail : null);

/** Subtle breadcrumb text: "Aqaid › Folder › Subfolder" (section, then visible folders). */
export function trailLabel(t, article) {
  return [sectionLabel(t, article.section), ...(article.folders || []).map((f) => f.title)].filter(Boolean).join(" › ");
}

export function ArticleCard({ article }) {
  const { contentLang } = useI18n();
  const cover = mediaUrl(article.coverKey);
  const title = pickVersion(article.title, article.titleTr, article.language, contentLang);
  return (
    <Link to={`/article/${article.slug}`} className="group flex h-full flex-col">
      {/* Flat style: sharp-corner cover image, then just the article title below it. No card box, border, shadow or path text. */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-tint">
        {cover && (
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        )}
      </div>
      <Text as="h3" className="mt-3 line-clamp-2 font-sans text-base font-semibold leading-snug tracking-normal group-hover:text-accent sm:text-[1.05rem]">{title}</Text>
    </Link>
  );
}

/** Topic = "folder": compact folder-tab + tile with a folder icon; the topic name sits below the card. Sized for 3 per row on mobile. */
export function TopicCard({ topic, to, label, pin, pinned }) {
  return (
    <Link to={to} className="group block min-w-0">
      <div className="relative transition duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <FolderIcon fluid />
        {pin ? <PinButton active={pin.active} onToggle={pin.onToggle} className="absolute end-1.5 top-[30%] !h-7 !w-7" />
          : pinned && <span title="Pinned by admin" className="btn-cta absolute end-1.5 top-[30%] grid h-6 w-6 place-items-center rounded-full"><Icon name="pin" size={12} /></span>}
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
      <FolderIcon size={26} className="shrink-0" />
      <div className="min-w-0">
        <Text as="h3" className="line-clamp-2 font-display text-sm font-bold leading-snug sm:text-base">{folder.title}</Text>
        {sectionLabel(t, folder.section) && <span className="block text-[11px] text-mute">{sectionLabel(t, folder.section)}</span>}
      </div>
    </Link>
  );
}

/* Corner flourishes cut straight from the reference screenshot. Size and position are % of the card, as measured in the reference.
   Each corner is its own element with its own image, so every one of the four is always drawn. */
const CORNERS = [
  { key: "tl", pos: { left: "3.04%", top: "3.28%" } },
  { key: "tr", pos: { right: "2.83%", top: "3.28%" } },
  { key: "bl", pos: { left: "3.04%", bottom: "4.64%" } },
  { key: "br", pos: { right: "2.83%", bottom: "4.64%" } },
];

/** Home page card for Aqaid / Masail: coloured Arabic title on top, English title below, flourish in all four corners.
 *  Same proportions, shadow and corner design as the reference app cards; two fit side by side on a phone. */
export function CategoryCard({ to, arabic, title, color, long = false }) {
  return (
    <Link to={to} className="cat-card card-lift group relative flex aspect-[494/366] min-w-0 flex-col items-center justify-center rounded-md border border-rule bg-card px-3 text-center shadow-[0_2px_8px_rgb(0_0_0/0.16)]">
      {CORNERS.map(({ key, pos }) => (
        <span key={key} aria-hidden="true" className="pointer-events-none absolute block w-[13.56%]"
          style={{ ...pos, aspectRatio: `${ORNAMENTS[key].w} / ${ORNAMENTS[key].h}`, backgroundImage: `url(${ORNAMENTS[key].src})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
      ))}
      <span dir="rtl" lang="ar" className={`cat-arabic whitespace-nowrap${long ? " cat-arabic-long" : ""}`} style={{ "--cat-color": color }}>{arabic}</span>
      <span className="mt-1 whitespace-nowrap font-sans text-[1.05rem] font-medium leading-tight text-ink sm:mt-2 sm:text-xl lg:text-2xl">{title}</span>
    </Link>
  );
}
