import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { SECTION_PATH, publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { useIsAdmin } from "../../lib/adminHint.js";
import { togglePin } from "../../lib/pins.js";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { folderPath } from "../../components/public/FoldersCard.jsx";
import { FolderSet, ViewAllLink, ViewAllText, CountText, FolderSearchBox } from "../../components/public/FolderGroups.jsx";

const SECTIONS = [["aqeedah", "aqaid"], ["masail", "masail"]];
/** Folders shown per section here (pinned first); the rest are one tap away under "View all". */
const SECTION_LIMIT = 24;
const SEARCH_LIMIT = 60;

const sectionKeyOf = (f) => (f.section === "aqeedah" ? "aqaid" : "masail");

/** /folders - Aqaid and Masail one after the other: pinned folders first, then up to 24 folders, and View all buttons.
 *  A search box on top finds a folder by name across both sections. */
export default function FoldersPage() {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  useMeta({ title: t.home.allFolders, description: "AthariTV ke saare folders: Aqaid aur Masail ke mazameen mauzu ke mutabiq." });

  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const id = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(id); }, [text]);

  const sections = useAsync(async (signal) => {
    const out = await Promise.all(SECTIONS.map(([type]) => publicApi.folders({ type, page: 1, limit: SECTION_LIMIT, pin: "all" }, signal)));
    return SECTIONS.map(([type, key], i) => ({ type, key, folders: out[i].folders, total: out[i].total }));
  }, []);
  const found = useAsync(async (signal) => (q ? publicApi.folders({ q, page: 1, limit: SEARCH_LIMIT, pin: "all" }, signal) : null), [q]);

  const reloadAll = () => { sections.reload(); found.reload(); };
  const pinFor = (f) => (isAdmin ? { active: f.pinAll, onToggle: async () => { if (await togglePin(f, "all")) reloadAll(); } } : undefined);
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const visible = (sections.data || []).filter((s) => s.folders.length);

  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.home.allFolders}</h1>

      <FolderSearchBox value={text} onChange={setText} onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }} placeholder={t.home.searchFolders} />

      <div className="mt-8">
        {q ? (
          found.loading && !found.data ? <CardSkeletons count={3} />
            : found.error && !found.data ? <ErrorState error={found.error} onRetry={found.reload} />
            : !found.data?.folders.length ? <EmptyState>{t.search.noResults}</EmptyState>
            : (
              <>
                <CountText shown={found.data.folders.length} total={found.data.total} t={t} />
                <FolderSet folders={found.data.folders} t={t} hrefFor={folderPath} labelFor={(f) => t.nav[sectionKeyOf(f)]} pinFor={pinFor} />
              </>
            )
        ) : sections.loading && !sections.data ? <CardSkeletons count={3} />
          : sections.error && !sections.data ? <ErrorState error={sections.error} onRetry={sections.reload} />
          : visible.length === 0 ? <EmptyState>{t.home.noFolders}</EmptyState>
          : (
            <>
              {visible.length > 1 && (
                <div className="mb-8 flex gap-2">
                  {visible.map((s) => <button key={s.key} type="button" onClick={() => jump(s.key)} className="btn-outline !px-4 !py-1.5 text-sm">{t.nav[s.key]}</button>)}
                </div>
              )}
              {visible.map((s, idx) => (
                <div key={s.type}>
                {idx > 0 && <hr className="mb-12 border-rule" />}
                <section id={s.key} className="mb-12 scroll-mt-20">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl font-bold sm:text-2xl">{t.nav[s.key]}</h2>
                    <ViewAllLink to={`/${SECTION_PATH[s.type]}`} t={t} />
                  </div>
                  <hr className="mt-3 border-rule" />
                  <FolderSet folders={s.folders} t={t} hrefFor={folderPath} labelFor={(f) => t.nav[sectionKeyOf(f)]} pinFor={pinFor} />
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <CountText shown={s.folders.length} total={s.total} t={t} />
                    <ViewAllText to={`/${SECTION_PATH[s.type]}`} t={t} />
                  </div>
                </section>
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}
