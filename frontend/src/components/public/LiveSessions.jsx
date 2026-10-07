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

function Countdown({ target, now, compact = false }) {
  const { d, h, m, s } = parts(new Date(target).getTime() - now);
  const cells = [["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]];
  return (
    <div className={`${compact ? "mt-3" : "mt-3"} grid grid-cols-4 gap-2 text-center`} role="timer" aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}>
      {cells.map(([label, value]) => (
        <div key={label} className={`rounded-lg bg-tint px-1 ${compact ? "py-1.5" : "py-2"}`}>
          <div className={`font-bold tabular-nums leading-none ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}>{String(value).padStart(2, "0")}</div>
          <div className={`mt-1 uppercase tracking-wide text-mute ${compact ? "text-[10px]" : "text-[11px]"}`}>{label}</div>
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
  ended: { label: "Live Ended", cls: "bg-tint text-mute" },
};

/** LIVE NOW / Upcoming / Starting soon / Recording pill, shown to the right of the title. */
function StateBadge({ state }) {
  const badge = BADGE[state];
  return (
    <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
      {state === "live" && <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />}
      {badge.label}
    </span>
  );
}

/**
 * Compact home-page card: same footprint as the "Latest posts" card (16:9 image +
 * title row). The whole card opens the YouTube video; the full card with countdown
 * and button is still used on /live.
 */
export function LiveSessionCompactCard({ session, now }) {
  const state = viewState(session, now);
  const when = state === "ended" ? session.actualStartTime || session.scheduledStartTime : session.scheduledStartTime || session.actualStartTime;
  const linked = isYouTubeUrl(session.youtubeUrl);
  const Wrapper = linked ? "a" : "div";
  const linkProps = linked ? { href: session.youtubeUrl, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Wrapper {...linkProps} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-3">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-tint">
        {session.thumbnailUrl && (
          <img
            src={session.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        )}
      </div>
      <div className="flex flex-1 items-start px-3 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 dir="auto" className="line-clamp-2 min-w-0 flex-1 font-display text-lg font-bold leading-snug sm:text-xl">{session.title}</h3>
            <StateBadge state={state} />
          </div>
          {when && <span className="mt-2 block text-xs text-mute">{formatDateTime(when)}</span>}
          {state === "upcoming" && <Countdown compact target={session.scheduledStartTime} now={now} />}
        </div>
      </div>
      <div className="flex justify-center px-3 pb-3">
        <span className="btn-youtube min-w-[10.5rem] !gap-2 !px-6 !py-2 !text-sm">
          <Icon name="youtube-logo" size={20} />{state === "live" ? "Watch Now" : "Watch on YouTube"}
        </span>
      </div>
    </Wrapper>
  );
}

export function LiveSessionCard({ session, now }) {
  const state = viewState(session, now);
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
        <div className="flex items-start justify-between gap-2">
          <h3 dir="auto" className="line-clamp-2 min-w-0 flex-1 font-display text-lg font-bold leading-snug sm:text-xl">{session.title}</h3>
          <StateBadge state={state} />
        </div>
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

/**
 * Which sessions the home page shows, in left-to-right order (oldest first):
 * up to two most recent recordings, then the live / upcoming one on the right.
 * With no upcoming session it is simply the three latest. `mobile` marks the single
 * card phones get: the live/upcoming one, else the latest recording.
 */
function pickHomeSessions(sessions, now) {
  const withState = sessions.map((s) => ({ s, state: viewState(s, now) }));
  const active = withState.filter((x) => x.state !== "ended"); // backend order: live, then soonest upcoming
  const ended = withState.filter((x) => x.state === "ended"); // backend order: most recent first
  const picks = [];
  if (active[0]) picks.push(active[0]);
  for (const e of ended) if (picks.length < 3) picks.push(e);
  for (const a of active.slice(1)) if (picks.length < 3) picks.push(a);

  const endedPicks = picks.filter((x) => x.state === "ended").reverse(); // oldest -> newest
  const activePicks = picks.filter((x) => x.state !== "ended");
  const ordered = [...endedPicks, ...activePicks];
  const mobileItem = activePicks[0] || ordered[ordered.length - 1];
  return ordered.map((x) => ({ ...x, mobile: x === mobileItem }));
}

/** Home page section — loads independently so a failure here never blanks the rest of the page. */
export function LiveSessionsSection() {
  const { data, error, loading, reload } = useAsync((signal) => publicApi.liveSessions({ limit: 12 }, signal), []);
  const needsTick = (data || []).some((s) => s.status === "scheduled");
  const now = useNow(needsTick);
  const picks = pickHomeSessions(data || [], now);

  return (
    <section className="container-page py-14 sm:py-20" aria-labelledby="live-heading">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title={<span id="live-heading">Live Sessions</span>} />
        <Link to="/live" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-4 py-1.5 text-sm font-medium text-accent transition hover:bg-btn hover:text-white">
          View all <Icon name="arrow" size={15} className="rtl:rotate-180" />
        </Link>
      </div>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : picks.length === 0 ? <LiveEmpty /> : (
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {picks.map(({ s, mobile }) => (
              <div key={s.id} className={mobile ? "" : "hidden md:block"}>
                <LiveSessionCompactCard session={s} now={now} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
