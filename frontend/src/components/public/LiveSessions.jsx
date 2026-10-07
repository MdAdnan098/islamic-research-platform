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

/** Derives what the card should show. The backend status is authoritative; a "scheduled" session whose start time has passed is shown as "Starting soon" until it flips to live. */
function viewState(session, now) {
  if (session.status === "live") return "live";
  if (session.status === "ended") return "ended";
  const start = session.scheduledStartTime ? new Date(session.scheduledStartTime).getTime() : null;
  return start && start > now ? "upcoming" : "starting";
}

const BADGE = {
  live: { label: "LIVE NOW", cls: "bg-red-600 text-white" },
  upcoming: { label: "Upcoming Live", cls: "bg-card text-accent" },
  starting: { label: "Starting soon", cls: "bg-card text-accent" },
  ended: { label: "Recording", cls: "bg-card text-mute" },
};

export function LiveSessionCard({ session, now }) {
  const state = viewState(session, now);
  const badge = BADGE[state];
  const when = state === "ended" ? session.actualStartTime || session.scheduledStartTime : session.scheduledStartTime || session.actualStartTime;
  const cta = state === "live" ? "Watch Live" : state === "ended" ? "Watch Recording" : "Open on YouTube";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-rule bg-card p-3 shadow-elev">
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
        <span className={`absolute start-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow-soft ${badge.cls}`}>
          {state === "live" && <span className="h-2 w-2 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden="true" />}
          {badge.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <h3 dir="auto" className="line-clamp-2 font-display text-lg font-bold leading-snug sm:text-xl">{session.title}</h3>
        {when && <p className="mt-2 text-sm text-mute">{formatDateTime(when)}</p>}
        {state === "upcoming" && <Countdown target={session.scheduledStartTime} now={now} />}
        <a
          href={session.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${state === "live" ? "btn-primary" : "btn-outline"} mt-auto w-full justify-center [margin-top:1.25rem]`}
        >
          <Icon name="youtube" size={16} />{cta}
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
