import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH } from "../../services/public.js";
import { Icon } from "../ui/icons.jsx";
import { Skeleton } from "../ui/feedback.jsx";
import { FolderTile } from "./Cards.jsx";

/** How many root folders the homepage card shows. */
const HOME_FOLDERS = 4;

export const folderPath = (folder) => `/${SECTION_PATH[folder.section] || "aqaid"}/${folder.slug}`;

/** The ONE homepage "Folders" card: title + "View All Folders" on top, up to four root-folder tiles in a 2x2 grid.
 *  Data comes from the homepage's single request (props), so the card adds no request of its own. */
export function FoldersCard({ folders: list, loading, error, onRetry }) {
  const { t } = useI18n();
  const folders = (list || []).slice(0, HOME_FOLDERS);
  const data = list;
  const reload = onRetry;

  return (
    <section className="container-page pb-4 pt-6 sm:pt-10">
      <div className="rounded-2xl border border-rule bg-card p-4 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold sm:text-2xl">{t.home.folders}</h2>
          <Link to="/folders" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-3.5 py-1.5 text-sm font-medium text-accent transition hover:bg-btn hover:text-white">
            {t.home.viewAllFolders} <Icon name="arrow" size={15} className="rtl:rotate-180" />
          </Link>
        </div>

        <div className="mt-4">
          {loading && !data ? (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2" aria-busy="true">{Array.from({ length: HOME_FOLDERS }).map((_, i) => <Skeleton key={i} className="h-[4.25rem] rounded-xl" />)}</div>
          ) : error && !data ? (
            <p className="py-6 text-center text-sm text-mute">{t.common.error} <button onClick={reload} className="text-accent underline">{t.common.retry}</button></p>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-rule px-6 py-8 text-center text-sm text-mute">
              <Icon name="folder" size={28} className="text-accent/60" />{t.home.noFolders}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {folders.map((f) => <FolderTile key={f.id} folder={f} to={folderPath(f)} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
