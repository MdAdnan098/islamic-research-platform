import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { slugify, formatDate, formatPrice } from "../../lib/format.js";
import { Empty, ErrorBox, Field, IconBtn, Modal, PageHeader, Spinner, StatusBadge, moveItem, toOrdering, useConfirm, useToast } from "../components/ui.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const STATUSES = [["draft", "Draft"], ["coming_soon", "Coming soon"], ["enrollment_open", "Enrollment open"], ["enrollment_closed", "Enrollment closed"], ["completed", "Completed"], ["archived", "Archived"]];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dateInput = (iso) => (iso ? String(iso).slice(0, 10) : "");

function CourseForm({ initial, nextOrder, onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: "", slug: "", shortDescription: "", description: "", teacher: "", thumbnailKey: "", startDate: "", endDate: "",
    price: "", currency: "INR", status: "draft", meetingLink: "", maxStudents: "", sortOrder: nextOrder, isPublished: false,
    ...(initial ? { ...initial, startDate: dateInput(initial.startDate), endDate: dateInput(initial.endDate), price: String(initial.price), maxStudents: initial.maxStudents ?? "", meetingLink: initial.meetingLink || "", thumbnailKey: initial.thumbnailKey || "", teacher: initial.teacher || "" } : {}),
  });
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const problem =
      !f.title.trim() ? "Title is required."
      : !SLUG_RE.test(f.slug) ? "Slug must be lowercase letters, numbers and single dashes (e.g. fiqh-basics)."
      : f.price === "" || !(Number(f.price) >= 0) ? "Enter a valid price (0 or more)."
      : f.status === "enrollment_open" && !(Number(f.price) > 0) ? "Set a price above 0 before opening enrollment."
      : f.startDate && f.endDate && f.endDate < f.startDate ? "End date cannot be before the start date."
      : null;
    if (problem) { toast(problem, "error"); return; }
    setBusy(true);
    const body = {
      title: f.title.trim(), slug: f.slug, shortDescription: f.shortDescription, description: f.description,
      teacher: f.teacher.trim() || null, thumbnailKey: f.thumbnailKey || null,
      startDate: f.startDate || null, endDate: f.endDate || null,
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date"><input type="date" className="a-input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="End date (optional)"><input type="date" className="a-input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (INR) *"><input type="number" min="0" step="0.01" className="a-input" required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Max students" hint="Blank = no limit"><input type="number" min="1" step="1" className="a-input" value={f.maxStudents} onChange={(e) => setF({ ...f, maxStudents: e.target.value })} /></Field>
        <Field label="Sort order" hint="Lower numbers show first. You can also use the arrows in the list."><input type="number" step="1" className="a-input" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <Field label="Enrollment status">
        <select className="a-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Google Meet link (private)" hint="Never shown on the website. Send it to enrolled students yourself (Enrollments page).">
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
                <p className="text-xs text-ad-mute">{formatPrice(c.price, c.currency)}{c.startDate ? ` · starts ${formatDate(c.startDate)}` : ""}{c.teacher ? ` · ${c.teacher}` : ""}</p>
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
