import { Link } from "react-router-dom";
import { Icon } from "../ui/icons.jsx";
import { SearchGo } from "../ui/SearchGo.jsx";
import { TopicCard } from "./Cards.jsx";

const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-4";

/** "View all" pill used next to a section heading and under its folders. */
export function ViewAllLink({ to, t }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium view-all transition">
      {t.home.viewAllBtn} <Icon name="arrow" size={15} className="rtl:rotate-180" />
    </Link>
  );
}

/** Small text-only "View all →" for the end of a section: no border, one colour (#3399CC) in Light and Dark. */
export function ViewAllText({ to, t }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#3399CC] hover:underline">
      {t.home.viewAllBtn} <Icon name="arrow" size={13} className="rtl:rotate-180" />
    </Link>
  );
}

/** Folder search field: magnifier while empty, "Go" once something is typed. Submitting searches right away. */
export function FolderSearchBox({ value, onChange, onSubmit, placeholder }) {
  return (
    <form onSubmit={onSubmit} role="search" className="mt-6 flex items-center gap-2 rounded-full border border-rule bg-field py-1.5 ps-5 pe-1.5 focus-within:border-accent">
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} dir="auto" enterKeyHint="search" placeholder={placeholder} aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink placeholder:text-mute focus:outline-none" />
      <button type="submit" aria-label={placeholder} className="btn-cta grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:opacity-90"><SearchGo active={value.trim().length > 0} size={18} /></button>
    </form>
  );
}

/** "10 of 37" style counter. */
export function CountText({ shown, total, t, className = "" }) {
  return <span className={`text-sm tabular-nums text-mute ${className}`}>{t.home.foldersCount.replace("{n}", shown).replace("{total}", total)}</span>;
}

/**
 * Folder cards of ONE section (or one search result list): the pinned ones first under a small "Pinned by admin" heading,
 * then the rest. hrefFor(folder) -> link, labelFor(folder) -> optional small label, pinFor(folder) -> admin pin props (or undefined).
 */
export function FolderSet({ folders, t, hrefFor, labelFor, pinFor }) {
  const pinned = folders.filter((f) => f.pinAll);
  const rest = folders.filter((f) => !f.pinAll);
  const card = (f) => <TopicCard key={f.id} topic={f} to={hrefFor(f)} label={labelFor?.(f)} pinned={f.pinAll} pin={pinFor?.(f)} />;
  return (
    <>
      {pinned.length > 0 && (
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-mute"><Icon name="pin" size={14} className="cta-text" />{t.home.pinnedByAdmin}</p>
          <div className={`mt-3 ${GRID}`}>{pinned.map(card)}</div>
        </div>
      )}
      {rest.length > 0 && <div className={`${pinned.length ? "mt-6 border-t border-rule pt-6" : "mt-5"} ${GRID}`}>{rest.map(card)}</div>}
    </>
  );
}
