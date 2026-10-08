import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { slugify, formatDate, formatPrice } from "../../lib/format.js";
import { addDaysToDateString, formatIstDateTime, toIstInput } from "../../lib/ist.js";
import { Empty, ErrorBox, Field, IconBtn, Modal, PageHeader, Spinner, StatusBadge, moveItem, toOrdering, useConfirm, useToast } from "../components/ui.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const STATUSES = [["draft", "Draft"], ["coming_soon", "Coming soon"], ["enrollment_open", "Enrollment open"], ["enrollment_closed", "Enrollment closed"], ["completed", "Completed"], ["archived", "Archived"]];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const blankGen = { date: "", start: "19:30", end: "21:00", days: "1" };

function CourseForm({ initial, nextOrder, onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: "", slug: "", shortDescription: "", description: "", teacher: "", thumbnailKey: "", startDate: "", endDate: "",
    price: "", currency: "INR", status: "draft", meetingLink: "", maxStudents: "", sortOrder: nextOrder, isPublished: false,
    enrollmentClosesAt: "", retentionDays: "0", sessions: [],
    ...(initial ? {
      ...initial, startDate: toIstInput(initial.startDate), endDate: toIstInput(initial.endDate), price: String(initial.price), maxStudents: initial.maxStudents ?? "",
      meetingLink: initial.meetingLink || "", thumbnailKey: initial.thumbnailKey || "", teacher: initial.teacher || "",
      enrollmentClosesAt: toIstInput(initial.enrollmentClosesAt), retentionDays: String(initial.retentionDays ?? 0),
      sessions: (initial.sessions || []).map((x) => ({ title: x.title || "", startsAt: toIstInput(x.startsAt), endsAt: toIstInput(x.endsAt), meetingLink: x.meetingLink || "" })),
    } : {}),
  });
  const [gen, setGen] = useState(blankGen);
  const hasSessions = f.sessions.length > 0;

  /** Builds N consecutive class days (IST) from the first date + daily start/end time; existing titles / links are kept by position. */
  function generateDays() {
    const n = Number(gen.days);
    if (!gen.date || !gen.start || !gen.end || !Number.isInteger(n) || n < 1 || n > 120) { toast("Enter the first class date, daily start and end time, and the number of days (1–120).", "error"); return; }
    const overnight = gen.end <= gen.start; // e.g. 22:00 → 00:30 ends on the next calendar day
    const rows = Array.from({ length: n }, (_, i) => {
      const day = addDaysToDateString(gen.date, i);
      const old = f.sessions[i] || {};
      return { title: old.title || "", meetingLink: old.meetingLink || "", startsAt: `${day}T${gen.start}`, endsAt: `${overnight ? addDaysToDateString(day, 1) : day}T${gen.end}` };
    });
    setF({ ...f, sessions: rows });
  }
  const setSession = (i, patch) => setF({ ...f, sessions: f.sessions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const removeSession = (i) => setF({ ...f, sessions: f.sessions.filter((_, j) => j !== i) });
  const addSession = () => {
    const last = f.sessions[f.sessions.length - 1];
    const day = last ? addDaysToDateString(last.startsAt.slice(0, 10), 1) : "";
    setF({ ...f, sessions: [...f.sessions, { title: "", meetingLink: "", startsAt: day ? `${day}T${last.startsAt.slice(11, 16)}` : "", endsAt: day ? `${day}T${last.endsAt.slice(11, 16)}` : "" }] });
  };
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const problem =
      !f.title.trim() ? "Title is required."
      : !SLUG_RE.test(f.slug) ? "Slug must be lowercase letters, numbers and single dashes (e.g. fiqh-basics)."
      : f.price === "" || !(Number(f.price) >= 0) ? "Enter a valid price (0 or more)."
      : f.status === "enrollment_open" && !(Number(f.price) > 0) ? "Set a price above 0 before opening enrollment."
      : !hasSessions && f.startDate && f.endDate && f.endDate < f.startDate ? "End time cannot be before the start time."
      : f.sessions.some((x) => !x.startsAt || !x.endsAt) ? "Every class day needs a start and an end date/time."
      : f.sessions.some((x) => x.endsAt <= x.startsAt) ? "Every class must end after it starts."
      : f.sessions.some((x, i) => i > 0 && x.startsAt < f.sessions[i - 1].endsAt) ? "Class days must be in order and cannot overlap."
      : hasSessions && f.enrollmentClosesAt && f.enrollmentClosesAt > f.sessions[f.sessions.length - 1].endsAt ? "Enrollment must close no later than the final class ends."
      : !(Number.isInteger(Number(f.retentionDays)) && Number(f.retentionDays) >= 0 && Number(f.retentionDays) <= 365) ? "Retention days must be a whole number from 0 to 365."
      : null;
    if (problem) { toast(problem, "error"); return; }
    setBusy(true);
    const body = {
      title: f.title.trim(), slug: f.slug, shortDescription: f.shortDescription, description: f.description,
      teacher: f.teacher.trim() || null, thumbnailKey: f.thumbnailKey || null,
      // Times are typed in IST; the server stores exact UTC instants. With class days, start/end follow the first/last day.
      ...(hasSessions ? {} : { startDate: f.startDate || null, endDate: f.endDate || null }),
      enrollmentClosesAt: f.enrollmentClosesAt || null,
      retentionDays: Number(f.retentionDays) || 0,
      sessions: f.sessions.map((x) => ({ title: x.title.trim(), startsAt: x.startsAt, endsAt: x.endsAt, meetingLink: x.meetingLink.trim() || null })),
      price: Number(f.price), currency: f.currency, status: f.status,
      meetingProvider: "google_meet", meetingLink: f.meetingLink.trim() || null,
      maxStudents: f.maxStudents === "" ? null : Number(f.maxStudents),
      sortOrder: Number(f.sortOrder) || 0, isPublished: f.status === "archived" ? false : f.isPublished,
    };
    try {
      initial ? await adminApi.courses.update(initial.id, body) : await adminApi.courses.create(body);
      toast("Course saved");
      onDone();
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title *"><input className="a-input" dir="auto" required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: touched ? f.slug : slugify(e.target.value) })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug *"><input className="a-input" required maxLength={200} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Lowercase letters, numbers and single dashes" value={f.slug} onChange={(e) => { setTouched(true); setF({ ...f, slug: e.target.value }); }} /></Field>
        <Field label="Teacher"><input className="a-input" dir="auto" value={f.teacher} onChange={(e) => setF({ ...f, teacher: e.target.value })} /></Field>
      </div>
      <Field label="Short description" hint="Shown on the course card (max 300 characters)."><textarea className="a-input min-h-16" dir="auto" maxLength={300} value={f.shortDescription} onChange={(e) => setF({ ...f, shortDescription: e.target.value })} /></Field>
      <Field label="Full description"><textarea className="a-input min-h-32" dir="auto" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div><span className="a-label">Thumbnail</span><MediaUploader value={f.thumbnailKey} onChange={(thumbnailKey) => setF({ ...f, thumbnailKey })} label="Upload thumbnail" /></div>
      <fieldset className="space-y-3 rounded-xl border border-ad-rule p-3">
        <legend className="px-1 text-sm font-semibold">Schedule <span className="font-normal text-ad-mute">— all times are IST (Asia/Kolkata), whatever your device's timezone is</span></legend>
        <Field label="Enrollment closes at" hint="Enrollment is open before this exact time and closes automatically at it. Blank = stays open until you change the status. Students who already paid stay enrolled.">
          <input type="datetime-local" className="a-input" value={f.enrollmentClosesAt} onChange={(e) => setF({ ...f, enrollmentClosesAt: e.target.value })} />
        </Field>
        {!hasSessions && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Course start (IST)"><input type="datetime-local" className="a-input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Course end (IST, optional)"><input type="datetime-local" className="a-input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          </div>
        )}

        <div className="rounded-lg bg-ad-bg p-3">
          <p className="text-xs font-semibold">Class days</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Field label="First class date"><input type="date" className="a-input" value={gen.date} onChange={(e) => setGen({ ...gen, date: e.target.value })} /></Field>
            <Field label="Daily start"><input type="time" className="a-input" value={gen.start} onChange={(e) => setGen({ ...gen, start: e.target.value })} /></Field>
            <Field label="Daily end"><input type="time" className="a-input" value={gen.end} onChange={(e) => setGen({ ...gen, end: e.target.value })} /></Field>
            <Field label="Number of days"><input type="number" min="1" max="120" step="1" className="a-input" value={gen.days} onChange={(e) => setGen({ ...gen, days: e.target.value })} /></Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="a-btn" onClick={generateDays}>{hasSessions ? "Regenerate days" : "Generate days"}</button>
            {hasSessions && <button type="button" className="a-btn" onClick={addSession}><Icon name="plus" size={14} />Add day</button>}
          </div>
          <p className="mt-1 text-xs text-ad-mute">Generates one row per day; every row stays editable (different times, titles, Meet links).{hasSessions ? " Course start / end follow the first / last day automatically." : ""}</p>
        </div>

        {hasSessions && (
          <ol className="space-y-2">
            {f.sessions.map((x, i) => (
              <li key={i} className="rounded-lg border border-ad-rule p-2">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">Day {i + 1}</span><IconBtn icon="trash" label={`Remove day ${i + 1}`} danger onClick={() => removeSession(i)} /></div>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <Field label="Starts (IST)"><input type="datetime-local" className="a-input" value={x.startsAt} onChange={(e) => setSession(i, { startsAt: e.target.value })} /></Field>
                  <Field label="Ends (IST)"><input type="datetime-local" className="a-input" value={x.endsAt} onChange={(e) => setSession(i, { endsAt: e.target.value })} /></Field>
                  <Field label="Topic (optional)"><input className="a-input" dir="auto" maxLength={150} value={x.title} onChange={(e) => setSession(i, { title: e.target.value })} /></Field>
                  <Field label="Google Meet link for this day (private)"><input className="a-input" type="url" placeholder="https://meet.google.com/…" value={x.meetingLink} onChange={(e) => setSession(i, { meetingLink: e.target.value })} /></Field>
                </div>
              </li>
            ))}
          </ol>
        )}

        <Field label="Keep on the website after the last class (days)" hint={`0 = the course disappears at 00:00 IST the day after the final class. Enrollments, payments and uploaded media are always kept.${initial?.archiveAt ? ` Currently scheduled to leave the site: ${formatIstDateTime(initial.archiveAt)}.` : ""}`}>
          <input type="number" min="0" max="365" step="1" className="a-input" value={f.retentionDays} onChange={(e) => setF({ ...f, retentionDays: e.target.value })} />
        </Field>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (INR) *"><input type="number" min="0" step="0.01" className="a-input" required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Max students" hint="Blank = no limit"><input type="number" min="1" step="1" className="a-input" value={f.maxStudents} onChange={(e) => setF({ ...f, maxStudents: e.target.value })} /></Field>
        <Field label="Sort order" hint="Lower numbers show first. You can also use the arrows in the list."><input type="number" step="1" className="a-input" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <Field label="Enrollment status">
        <select className="a-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Fallback Google Meet link (private)" hint="Never shown on the website. Used only when a day has no link of its own. Enrolled students see a day's link only around its class time.">
        <input className="a-input" type="url" placeholder="https://meet.google.com/…" value={f.meetingLink} onChange={(e) => setF({ ...f, meetingLink: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={f.status === "archived"} checked={f.isPublished && f.status !== "archived"} onChange={(e) => setF({ ...f, isPublished: e.target.checked })} />Published on the website{f.status === "draft" && <span className="text-xs text-ad-mute">(drafts stay hidden until the status is changed)</span>}</label>
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="a-btn" onClick={onCancel}>Cancel</button><button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export default function Courses() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data, error, loading, reload, setData } = useAsync(async (s) => (await adminApi.courses.list({}, s)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), []);

  async function patch(c, body) {
    try { await adminApi.courses.update(c.id, body); reload(); } catch (e) { toast(e.message, "error"); reload(); }
  }
  async function move(i, to) {
    const next = moveItem(data, i, to);
    if (next === data) return;
    setData(next);
    try { await adminApi.courses.reorder(toOrdering(next)); } catch (e) { toast(e.message, "error"); reload(); }
  }
  async function archive(c) {
    if (!(await confirm({ title: "Archive course", message: `“${c.title}” will be hidden from the public site and enrollment will stop. Its enrollments and payments are kept. You can restore it later by changing its status.`, confirm: "Archive", danger: true }))) return;
    try { await adminApi.courses.archive(c.id); toast("Archived"); reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function remove(c) {
    if (!(await confirm({ title: "Delete course", message: `“${c.title}” will be permanently deleted. Courses with payment records can't be deleted — archive them instead.`, confirm: "Delete", danger: true }))) return;
    try { await adminApi.courses.remove(c.id); toast("Deleted"); reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="Courses" desc="Courses shown in “Our Courses”. Enrollments and payments are under their own menu items.">
        <button className="a-btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />Add course</button>
      </PageHeader>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>No courses yet.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="flex"><IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} /><IconBtn icon="down" label="Move down" disabled={i === data.length - 1} onClick={() => move(i, i + 1)} /></div>
              <div className="min-w-0 flex-1 basis-56">
                <p dir="auto" className="truncate text-sm font-medium">{c.title}</p>
                <p className="text-xs text-ad-mute">{formatPrice(c.price, c.currency)}{c.startDate ? ` · starts ${c.sessions?.length ? formatIstDateTime(c.startDate) : formatDate(c.startDate)}` : ""}{c.teacher ? ` · ${c.teacher}` : ""}</p>
                {c.lifecycle?.label && <p className="text-xs font-medium">{c.lifecycle.label}{c.lifecycle.enrollment?.state === "closed" && c.status === "enrollment_open" ? " · enrollment closed (deadline passed)" : ""}</p>}
              </div>
              <select className="a-input !w-auto" value={c.status} onChange={(e) => patch(c, { status: e.target.value })} aria-label="Enrollment status">
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <StatusBadge status={c.status === "archived" ? "archived" : c.isPublished ? "published" : "draft"} />
              {c.status !== "archived" && <button className={c.isPublished ? "a-btn" : "a-btn-primary"} onClick={() => patch(c, { isPublished: !c.isPublished })}>{c.isPublished ? "Unpublish" : "Publish"}</button>}
              <IconBtn icon="edit" label="Edit" onClick={() => setEditing(c)} />
              {c.status !== "archived" && <button className="a-btn" onClick={() => archive(c)}>Archive</button>}
              <IconBtn icon="trash" label="Delete" danger onClick={() => remove(c)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <Modal wide title={editing === "new" ? "Add course" : "Edit course"} onClose={() => setEditing(null)}><CourseForm initial={editing === "new" ? null : editing} nextOrder={data?.length || 0} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /></Modal>}
      {dialog}
    </>
  );
}
