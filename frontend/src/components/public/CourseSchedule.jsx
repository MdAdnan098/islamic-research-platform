import { deriveSchedule, formatCountdown, formatIstDate, formatIstDateTime, formatIstTime } from "../../lib/ist.js";

const CHIP = {
  upcoming: "border border-rule bg-card text-mute",
  live: "bg-red-600 text-white",
  completed: "bg-soft text-mute",
};
const CHIP_LABEL = { upcoming: "Upcoming", live: "LIVE NOW", completed: "Completed" };

/**
 * Class days + enrollment deadline for a public course. All times are IST. `now` is the server-aligned clock
 * from useServerClock: the countdowns here are a visual of (authoritative timestamp − now), nothing more.
 */
export function CourseSchedule({ course, now }) {
  const sessions = course.sessions || [];
  const schedule = deriveSchedule(sessions, now);
  const closesAt = course.enrollmentClosesAt ? Date.parse(course.enrollmentClosesAt) : null;
  const showClosing = closesAt && (course.status === "enrollment_open" || course.status === "enrollment_closed") && schedule.phase !== "completed";

  if (sessions.length === 0 && !showClosing) return null;
  const live = schedule.badge === "live_now";

  return (
    <section className="mb-8 rounded-2xl border border-rule bg-card p-5" aria-label="Class schedule">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Class schedule <span className="text-sm font-normal text-mute">(IST)</span></h2>
        {schedule.label && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-red-600 text-white" : "border border-rule bg-soft text-ink"}`}>
            {live && <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />}{schedule.label}
          </span>
        )}
      </div>

      {schedule.next && (
        <p className="mt-3 text-sm text-mute" aria-live="off">
          {schedule.next.kind === "ends" ? `Day ${schedule.next.day} ends in ` : `Day ${schedule.next.day} starts in `}
          <strong className="tabular-nums text-ink">{formatCountdown(schedule.next.at - now)}</strong>
        </p>
      )}
      {showClosing && (
        <p className="mt-1 text-sm text-mute">
          {now < closesAt ? <>Enrollment closes {formatIstDateTime(course.enrollmentClosesAt)} · in <strong className="tabular-nums text-ink">{formatCountdown(closesAt - now)}</strong></> : <>Enrollment closed {formatIstDateTime(course.enrollmentClosesAt)}</>}
        </p>
      )}

      {schedule.days.length > 0 && (
        <ol className="mt-4 divide-y divide-rule">
          {schedule.days.map((d) => (
            <li key={d.day} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <p dir="auto" className="font-medium">Day {d.day}{d.title ? ` — ${d.title}` : ""}</p>
                <p className="text-xs text-mute">{formatIstDate(d.startsAt)} · {formatIstTime(d.startsAt)} – {formatIstTime(d.endsAt)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${CHIP[d.status]}`}>
                {d.status === "live" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}{CHIP_LABEL[d.status]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
