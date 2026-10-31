import { Link } from "react-router-dom";
import { FolderIcon } from "../ui/FolderIcon.jsx";
import { PinButton } from "./PinButton.jsx";
import { useIsAdmin } from "../../lib/adminHint.js";
import { togglePin } from "../../lib/pins.js";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH } from "../../services/public.js";
import { Icon } from "../ui/icons.jsx";
import { Skeleton } from "../ui/feedback.jsx";
import { Text } from "../ui/Text.jsx";

/** How many root folders the homepage list shows (the backend sends the newest 10; the rest are under "View All Folders"). */
const HOME_FOLDERS = 10;

export const folderPath = (folder) => `/${SECTION_PATH[folder.section] || "aqaid"}/${folder.slug}`;

const sectionLabel = (t, type) => (type === "aqeedah" ? t.nav.aqaid : type === "masail" ? t.nav.masail : null);

/** One row: folder icon, full folder name (with a small Aqaid / Masail label under it), article count on the right. */
function FolderRow({ folder, to, label, pin }) {
  const count = folder.articleCount;
  return (
    <Link to={to} className="group flex items-center gap-3 border-t border-rule px-1 py-3 transition first:border-t-0 hover:bg-tint/60">
      <FolderIcon size={22} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <Text as="h3" className="font-display text-sm font-bold leading-snug sm:text-base">{folder.title}</Text>
        {label && <span className="block text-[11px] leading-tight text-mute">{label}</span>}
      </div>
      {typeof count === "number" && (
        <span className="shrink-0 rounded-full bg-tint px-2.5 py-0.5 text-xs font-medium text-mute">{count}</span>
      )}
      {pin && <PinButton active={folder.pinHome} onToggle={pin} />}
    </Link>
  );
}

/** Homepage "Folders" list: title + "View All Folders", then the newest folders (up to 10) in a vertically scrolling list.
 *  Data comes from the homepage's single request (props), so the card adds no request of its own. */
export function FoldersCard({ folders: list, total, loading, error, onRetry, onChanged }) {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const folders = (list || []).slice(0, HOME_FOLDERS);
  // Pinned folders stay fixed on top; only the rest scrolls underneath.
  const pinned = folders.filter((f) => f.pinHome);
  const rest = folders.filter((f) => !f.pinHome);
  const pinFor = (f) => (isAdmin ? async () => { if (await togglePin(f, "home")) onChanged?.(); } : null);
  const countText = typeof total === "number" ? t.home.foldersCount.replace("{n}", folders.length).replace("{total}", total) : null;
  const data = list;
  const reload = onRetry;

  return (
    <section className="container-page pb-4 pt-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold sm:text-2xl">{t.home.folders}</h2>
        {countText && <span className="min-w-0 flex-1 text-center text-xs font-medium tabular-nums text-mute sm:text-sm" aria-label={`${folders.length} / ${total}`}>{countText}</span>}
        <Link to="/folders" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium view-all transition hover:bg-btn hover:text-white">
          {t.home.viewAllFolders} <Icon name="arrow" size={15} className="rtl:rotate-180" />
        </Link>
      </div>

      <div className="mt-3">
        {loading && !data ? (
          <div className="space-y-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : error && !data ? (
          <p className="py-6 text-center text-sm text-mute">{t.common.error} <button onClick={reload} className="text-accent underline">{t.common.retry}</button></p>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-rule px-6 py-8 text-center text-sm text-mute">
            <FolderIcon size={28} />{t.home.noFolders}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-rule bg-card px-3">
            {pinned.length > 0 && (
              <div className="-mx-3 border-b border-rule bg-tint/40 px-3">
                <p className="flex items-center gap-1.5 pb-0.5 pt-2 text-[11px] font-medium text-mute">
                  <Icon name="pin" size={12} className="cta-text" />{t.home.pinnedByAdmin}
                </p>
                {pinned.map((f) => <FolderRow key={f.id} folder={f} to={folderPath(f)} label={sectionLabel(t, f.section)} pin={pinFor(f)} />)}
              </div>
            )}
            <div style={{ "--ph": `${pinned.length * 3.6 + (pinned.length ? 1.6 : 0)}rem` }} className="max-h-[max(9rem,calc(19rem_-_var(--ph)))] overflow-y-auto overscroll-auto sm:max-h-[max(9rem,calc(22rem_-_var(--ph)))]">
              {rest.map((f) => <FolderRow key={f.id} folder={f} to={folderPath(f)} label={sectionLabel(t, f.section)} pin={pinFor(f)} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
