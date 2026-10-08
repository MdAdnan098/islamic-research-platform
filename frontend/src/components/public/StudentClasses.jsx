import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useServerClock } from "../../lib/useServerClock.js";
import { formatIstDate, formatIstTime } from "../../lib/ist.js";

/**
 * "Your classes" for an enrolled student. The claim token that started the paid order proves who paid (no login
 * is involved). The server decides what is visible: a Meet link only appears for a class that is live or about to
 * start, and disappears once that class has ended.
 */
export function StudentClasses({ course, claim }) {
  const { data, reload } = useAsync((signal) => publicApi.courseAccess(course.id, { orderId: claim.orderId, claimToken: claim.claimToken }, signal), [course.id, claim.orderId]);
  useServerClock({ serverTime: data?.serverTime, nextTransitionAt: data?.nextChangeAt, onSync: reload, tick: false });

  if (!data) return null;
  const sessions = data.sessions || [];
  if (sessions.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-rule bg-card p-3 text-sm">
      <p className="font-semibold">Your classes <span className="font-normal text-mute">(IST)</span></p>
      <ul className="mt-2 divide-y divide-rule">
        {sessions.map((s) => (
          <li key={s.day} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p dir="auto" className="font-medium">Day {s.day}{s.title ? ` — ${s.title}` : ""}</p>
              <p className="text-xs text-mute">{formatIstDate(s.startsAt)} · {formatIstTime(s.startsAt)} – {formatIstTime(s.endsAt)}</p>
            </div>
            {s.status === "completed" ? (
              <span className="text-xs text-mute">Completed</span>
            ) : s.meetingLink ? (
              <a className="btn-primary !px-4 !py-1.5 !text-xs" href={s.meetingLink} target="_blank" rel="noopener noreferrer">{s.status === "live" ? "Join class — LIVE NOW" : "Join class"}</a>
            ) : (
              <span className="text-xs text-mute">Link appears 30 min before</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
