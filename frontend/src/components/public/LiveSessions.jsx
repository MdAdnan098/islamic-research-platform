import { Link } from "react-router-dom";
import { SOCIAL } from "../../config/env.js";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useNow } from "../../lib/useNow.js";
import { formatDateTime } from "../../lib/format.js";
import { Icon } from "../ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../ui/feedback.jsx";

/** Splits a duration into countdown units. */
function parts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

function Countdown({ target, now }) {
  const { d, h, m, s } = parts(new Date(target).getTime() - now);
  const cells = [["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]];
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 text-center" role="timer" aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}>
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-tint px-1 py-2">
          <div className="text-lg font-bold tabular-nums leading-none sm:text-xl">{String(value).padStart(2, "0")}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-mute">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors the backend: a "scheduled" session goes LIVE by itself once its start time passes (for 12h; keep in sync with AUTO_LIVE_WINDOW_MS in liveSession.service.js). */
const AUTO_LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Derives what the card should show. Manual "live"/"ended" always win; only a "scheduled" session is promoted automatically. */
function viewState(session, now) {
  if (session.status === "live") return "live";
  if (session.status === "ended") return "ended";
  const start = session.scheduledStartTime ? new Date(session.scheduledStartTime).getTime() : null;
  if (start && start > now) return "upcoming";
  if (start && now - start <= AUTO_LIVE_WINDOW_MS) return "live";
  return "starting";
}

/** Only real YouTube links are made card-clickable. */
function isYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(u.hostname);
  } catch {
    return false;
  }
}

const BADGE = {
  live: { label: "LIVE NOW", cls: "live-badge bg-red-600 text-white" },
  upcoming: { label: "Upcoming Live", cls: "bg-tint text-accent" },
  starting: { label: "Starting soon", cls: "bg-tint text-accent" },
  ended: { label: "Recording", cls: "bg-tint text-mute" },
};

export function LiveSessionCard({ session, now }) {
  const state = viewState(session, now);
  const badge = BADGE[state];
  const when = state === "ended" ? session.actualStartTime || session.scheduledStartTime : session.scheduledStartTime || session.actualStartTime;
  const cta = state === "live" ? "Watch Live" : state === "ended" ? "Watch Recording" : "Open on YouTube";

  // A LIVE session with a valid YouTube link opens on tap anywhere on the card; real links/buttons inside keep their own behaviour.
  const clickable = state === "live" && isYouTubeUrl(session.youtubeUrl);
  const openCard = (e) => {
    if (e.target.closest("a, button, input, select, textarea, label, [data-no-card-click]")) return;
    window.open(session.youtubeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      onClick={clickable ? openCard : undefined}
      className={`flex h-full flex-col rounded-2xl border border-rule bg-card p-3 shadow-elev ${clickable ? "card-lift cursor-pointer" : ""}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-tint">
        {session.thumbnailUrl && (
          <img
            src={session.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
          {state === "live" && <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />}
          {badge.label}
        </span>
        <h3 dir="auto" className="mt-3 line-clamp-2 font-display text-lg font-bold leading-snug sm:text-xl">{session.title}</h3>
        {when && <p className="mt-2 text-sm text-mute">{formatDateTime(when)}</p>}
        {state === "upcoming" && <Countdown target={session.scheduledStartTime} now={now} />}
        <a
          href={session.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-youtube mt-auto w-full justify-center [margin-top:1.25rem]"
        >
          <Icon name="youtube-logo" size={22} />{cta}
        </a>
      </div>
    </article>
  );
}

/** Grid + empty/error handling shared by the home section and the /live page. */
export function LiveSessionGrid({ sessions, now }) {
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => <LiveSessionCard key={s.id} session={s} now={now} />)}
    </div>
  );
}

export function LiveEmpty() {
  return (
    <EmptyState>
      <p>No live sessions at the moment.</p>
      <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
        <Icon name="youtube" size={15} />Follow our YouTube channel
      </a>
    </EmptyState>
  );
}

/** Home page section — loads independently so a failure here never blanks the rest of the page. */
export function LiveSessionsSection() {
  const { data, error, loading, reload } = useAsync((signal) => publicApi.liveSessions({ limit: 6 }, signal), []);
  const visible = (data || []).slice(0, 3);
  const needsTick = visible.some((s) => s.status === "scheduled");
  const now = useNow(needsTick);

  return (
    <section className="container-page py-14 sm:py-20" aria-labelledby="live-heading">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title={<span id="live-heading">Live Sessions</span>} />
        <Link to="/live" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-4 py-1.5 text-sm font-medium text-accent transition hover:bg-btn hover:text-white">
          View all <Icon name="arrow" size={15} className="rtl:rotate-180" />
        </Link>
      </div>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : visible.length === 0 ? <LiveEmpty /> : <LiveSessionGrid sessions={visible} now={now} />}
      </div>
    </section>
  );
}
