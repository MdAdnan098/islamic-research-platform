import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { SOCIAL } from "../../config/env.js";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useNow } from "../../lib/useNow.js";
import { formatDateTime } from "../../lib/format.js";
import { Icon } from "../ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../ui/feedback.jsx";

/** Splits a duration in milliseconds into countdown units accurately. */
function parts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s };
}

function Countdown({ target, now, compact = false }) {
  const targetMs = typeof target === "number" ? target : new Date(target).getTime();
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  const diff = targetMs - nowMs;

  const { d, h, m, s } = parts(diff);
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
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  if (!start) return "ended"; // no schedule: an already-streamed video, shown as a recording
  if (start > nowMs) return "upcoming";
  if (nowMs - start <= AUTO_LIVE_WINDOW_MS) return "live";
  return "ended";
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

/** "Open YouTube?" confirmation, so an accidental tap on a card never jumps straight out of the site. Rendered in <body> so no transformed/clipped parent affects it. */
function ConfirmYouTube({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const stop = (e) => e.stopPropagation();
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-5" onClick={onClose} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
      <div role="dialog" aria-modal="true" aria-labelledby="yt-confirm-title" onClick={stop} className="w-full max-w-sm rounded-2xl border border-rule bg-card p-6 shadow-elev">
        <h3 id="yt-confirm-title" className="font-display text-lg font-bold">Open YouTube?</h3>
        <p className="mt-2 text-sm text-mute">This will open the video on YouTube in a new tab.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline !px-5 !py-2 !text-sm">Cancel</button>
          <button
            type="button"
            autoFocus
            onClick={() => { window.open(url, "_blank", "noopener,noreferrer"); onClose(); }}
            className="btn-youtube !gap-2 !px-5 !py-2 !text-sm"
          >
            <Icon name="youtube-logo" size={18} />Open YouTube
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Compact home-page card: same footprint as the "Latest posts" card (16:9 image +
 * title row). The whole card opens the YouTube video; the full card with countdown
 * and button is still used on /live.
 */
export function LiveSessionCompactCard({ session, now, onConfirmChange }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => { onConfirmChange?.(asking); }, [asking]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = viewState(session, now);
  const when = state === "ended" ? session.actualStartTime || session.scheduledStartTime : session.scheduledStartTime || session.actualStartTime;
  const linked = isYouTubeUrl(session.youtubeUrl);
  const Wrapper = linked ? "a" : "div";
  // A plain tap asks first; ctrl/cmd/shift/middle click keep the browser's own behaviour.
  const ask = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setAsking(true);
  };
  const linkProps = linked ? { href: session.youtubeUrl, target: "_blank", rel: "noopener noreferrer", onClick: ask } : {};
  return (
    <>
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
    {asking && <ConfirmYouTube url={session.youtubeUrl} onClose={() => setAsking(false)} />}
    </>
  );
}

export function LiveSessionCard({ session, now }) {
  const state = viewState(session, now);
  const when = state === "ended" ? session.actualStartTime || session.scheduledStartTime : session.scheduledStartTime || session.actualStartTime;
  const cta = state === "live" ? "Watch Live" : state === "ended" ? "Watch Recording" : "Open on YouTube";

  // A LIVE session with a valid YouTube link opens on tap anywhere on the card; real links/buttons inside keep their own behaviour.
  const [asking, setAsking] = useState(false);
  const clickable = state === "live" && isYouTubeUrl(session.youtubeUrl);
  const openCard = (e) => {
    if (e.target.closest("a, button, input, select, textarea, label, [data-no-card-click]")) return;
    setAsking(true);
  };

  return (
    <>
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
    {asking && <ConfirmYouTube url={session.youtubeUrl} onClose={() => setAsking(false)} />}
    </>
  );
}

/** Newest first, whatever the state (upcoming / live / recording): the latest session is on top, the oldest comes last. */
function sortNewestFirst(sessions) {
  const time = (s) => {
    const t = new Date(s.scheduledStartTime || s.actualStartTime || s.createdAt).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const made = (s) => {
    const t = new Date(s.createdAt).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  return [...sessions].sort((a, b) => time(b) - time(a) || made(b) - made(a));
}

/** Grid + empty/error handling shared by the home section and the /live page. */
export function LiveSessionGrid({ sessions, now }) {
  const ordered = useMemo(() => sortNewestFirst(sessions), [sessions]);
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((s) => <LiveSessionCard key={s.id} session={s} now={now} />)}
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

const SLIDE_MS = 3500;

/**
 * Phone view: shows the latest session first; every few seconds the card slides out to the left and the one posted
 * before it comes in from the right, down to the oldest, then it jumps back to the latest. The reader can also swipe
 * with a finger in either direction. Autoplay pauses while touching and while the "Open YouTube?" dialog is open.
 * `sessions` is newest -> oldest and is laid out left to right in that order.
 */
function MobileLiveCarousel({ sessions, now }) {
  // While the latest session is still upcoming (countdown running) or live, it stays pinned: only that card is shown,
  // static, with no auto-slide and no swipe. The moment it ends it is simply the first card of the normal carousel.
  const pinned = sessions.length > 0 && viewState(sessions[0], now) !== "ended";
  if (pinned) {
    return (
      <div className="py-1">
        <div className="px-0.5"><LiveSessionCompactCard session={sessions[0]} now={now} /></div>
      </div>
    );
  }
  return <SlidingLiveCarousel sessions={sessions} now={now} />;
}

function SlidingLiveCarousel({ sessions, now }) {
  const n = sessions.length;
  const [pos, setPos] = useState({ i: 0, anim: true });
  const [touching, setTouching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [drag, setDrag] = useState(null); // px the finger has dragged the track, null when not dragging
  const box = useRef(null);
  const touch = useRef({ x: 0, y: 0, axis: null, w: 1 });
  const moved = useRef(false);

  useEffect(() => { setPos({ i: 0, anim: true }); }, [n]);
  useEffect(() => {
    if (n < 2 || touching || asking) return undefined;
    const id = setTimeout(() => {
      setPos((p) => (p.i >= n - 1 ? { i: 0, anim: false } : { i: p.i + 1, anim: true }));
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [pos, n, touching, asking]);

  const onStart = (e) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, axis: null, w: box.current?.offsetWidth || 1 };
    moved.current = false;
    setTouching(true);
  };
  const onMove = (e) => {
    const c = touch.current;
    const p = e.touches[0];
    const dx = p.clientX - c.x;
    const dy = p.clientY - c.y;
    if (!c.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      c.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; // vertical = normal page scroll, left alone
    }
    if (c.axis !== "x") return;
    if (Math.abs(dx) > 8) moved.current = true;
    const atEdge = (dx > 0 && pos.i === 0) || (dx < 0 && pos.i === n - 1);
    setDrag(atEdge ? dx / 3 : dx);
  };
  const onEnd = () => {
    const c = touch.current;
    if (c.axis === "x" && drag !== null) {
      const limit = Math.max(40, c.w * 0.18);
      let i = pos.i;
      if (drag < -limit && i < n - 1) i += 1; // swipe left -> older card
      else if (drag > limit && i > 0) i -= 1; // swipe right -> newer card
      setPos({ i, anim: true });
    }
    c.axis = null;
    setDrag(null);
    setTouching(false);
  };
  // A swipe must never count as a tap on the card underneath.
  const swallowClick = (e) => {
    if (!moved.current) return;
    e.preventDefault();
    e.stopPropagation();
    moved.current = false;
  };

  return (
    <div
      ref={box}
      dir="ltr"
      className="touch-pan-y overflow-hidden py-1"
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onClickCapture={swallowClick}
    >
      <div
        className={`flex items-stretch ${drag === null && pos.anim ? "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" : ""}`}
        style={{ transform: `translateX(calc(${-pos.i * 100}% + ${drag || 0}px))` }}
      >
        {sessions.map((s) => (
          <div key={s.id} className="w-full shrink-0 px-0.5">
            <LiveSessionCompactCard session={s} now={now} onConfirmChange={setAsking} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home page section — loads independently so a failure here never blanks the rest of the page. */
export function LiveSessionsSection() {
  const { data, error, loading, reload } = useAsync((signal) => publicApi.liveSessions({ limit: 12 }, signal), []);
  const needsTick = (data || []).some((s) => s.status === "scheduled");
  const now = useNow(needsTick);
  const ordered = useMemo(() => sortNewestFirst(data || []), [data]); // newest -> oldest

  // While the latest session is upcoming/live the carousel is pinned; re-check the server every 30s so that when the
  // admin ends it (or a new one is added) the page updates by itself, without a reload.
  const latestOpen = ordered.length > 0 && viewState(ordered[0], now) !== "ended";
  useEffect(() => {
    if (!latestOpen) return undefined;
    const id = setInterval(() => { if (!document.hidden) reload(); }, 30000);
    return () => clearInterval(id);
  }, [latestOpen, reload]);

  return (
    <section className="container-page py-14 sm:py-20" aria-labelledby="live-heading">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title={<span id="live-heading">Live Sessions</span>} />
        <Link to="/live" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium view-all transition hover:bg-btn hover:text-white">
          View all <Icon name="arrow" size={15} className="rtl:rotate-180" />
        </Link>
      </div>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : ordered.length === 0 ? <LiveEmpty /> : (
          <>
            {/* Phones: auto-sliding single card, latest first. */}
            <div className="md:hidden"><MobileLiveCarousel sessions={ordered} now={now} /></div>
            {/* Desktop: the three latest, newest on the left. */}
            <div className="hidden items-stretch gap-5 md:grid md:grid-cols-3">
              {ordered.slice(0, 3).map((s) => (
                <div key={s.id}><LiveSessionCompactCard session={s} now={now} /></div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
