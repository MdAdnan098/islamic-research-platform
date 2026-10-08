import { useEffect, useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { Empty, ErrorBox, Modal, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const waLink = (number, text) => `https://wa.me/${String(number).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const STATUSES = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]];
const PAYMENT_STATUSES = [["unpaid", "Unpaid"], ["paid", "Paid"], ["failed", "Failed"], ["refunded", "Refunded"]];
// Mirrors the server's rules (utils/courseEnums.js ENROLLMENT_TRANSITIONS); the server is the authority.
const NEXT = { pending: ["approved", "rejected", "cancelled"], approved: ["pending", "cancelled"], rejected: ["pending"], cancelled: ["pending"] };
const ACTION_LABEL = { approved: "Approve", rejected: "Reject", cancelled: "Cancel", pending: "Move back to pending" };

function Row({ label, children }) {
  return <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-sm"><dt className="text-ad-mute">{label}</dt><dd dir="auto" className="min-w-0 break-words text-right font-medium">{children}</dd></div>;
}

function Details({ e, onAction, onSendLink, onClose }) {
  const price = e.course?.price;
  return (
    <Modal title="Enrollment details" onClose={onClose}>
      <dl className="divide-y divide-ad-rule">
        <Row label="Student">{e.fullName}</Row>
        <Row label="WhatsApp"><a className="underline" href={waLink(e.whatsapp)} target="_blank" rel="noopener noreferrer">{e.whatsapp}</a></Row>
        <Row label="Email">{e.email ? <a className="underline" href={`mailto:${e.email}`}>{e.email}</a> : "—"}</Row>
        <Row label="Course">{e.course?.title || "Deleted course"}{typeof price === "number" ? ` · ${formatPrice(price, e.course.currency)}` : ""}</Row>
        <Row label="Status"><StatusBadge status={e.status} /></Row>
        <Row label="Payment"><StatusBadge status={e.paymentStatus} /></Row>
        {e.payment && <Row label="Gateway amount">{formatPrice(e.payment.amount / 100, e.payment.currency)}</Row>}
        <Row label="Source">{e.source === "payment" ? "Paid online" : "Enrollment request"}</Row>
        <Row label="Requested">{dateTime(e.createdAt)}</Row>
        <Row label="Last updated">{dateTime(e.updatedAt)}</Row>
        {e.meetLinkSentAt && <Row label="Class link sent">{dateTime(e.meetLinkSentAt)}</Row>}
      </dl>
      <p className="mt-3 text-xs text-ad-mute">Payment status is set by the server only and cannot be edited here.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(NEXT[e.status] || []).map((s) => (
          <button key={s} className={s === "approved" ? "a-btn-primary" : "a-btn"} onClick={() => onAction(e, s)}>{ACTION_LABEL[s]}</button>
        ))}
        {e.status === "approved" && e.course?.meetingLink && (
          <button className="a-btn" onClick={() => onSendLink(e)}>{e.meetLinkSentAt ? "Send class link again" : "Send class link on WhatsApp"}</button>
        )}
      </div>
    </Modal>
  );
}

export default function Enrollments() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounced search term actually sent to the server
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const courses = useAsync((s) => adminApi.courses.list({}, s), []);
  const { data, error, loading, reload, setData } = useAsync(
    (s) => adminApi.enrollments.list({ courseId, status, paymentStatus, q, limit: 200 }, s),
    [courseId, status, paymentStatus, q]
  );
  const selected = data?.find((x) => x.id === selectedId) || null;
  const merge = (saved) => setData((list) => list.map((x) => (x.id === saved.id ? saved : x)));

  async function update(e, body) {
    try { merge(await adminApi.enrollments.update(e.id, body)); return true; } catch (err) { toast(err.message, "error"); return false; }
  }
  async function changeStatus(e, next) {
    if (next === "approved" && e.paymentStatus !== "paid" && e.course?.price > 0) {
      if (!(await confirm({ title: "Approve unpaid enrollment?", message: `${e.fullName} has not paid for “${e.course.title}” (payment status: ${e.paymentStatus}). Approve only if you have received payment another way.`, confirm: "Approve anyway" }))) return;
    } else if (next === "rejected" || next === "cancelled") {
      if (!(await confirm({ title: `${ACTION_LABEL[next]} enrollment`, message: `${e.fullName} — ${e.course?.title || "course"}. You can move it back to pending later.`, confirm: ACTION_LABEL[next], danger: true }))) return;
    }
    if (await update(e, { status: next })) toast("Updated");
  }
  /** Opens WhatsApp with the Meet link pre-filled (the link only ever travels admin → student), then records that it was sent. */
  function sendMeetLink(e) {
    const text = `Assalamu alaikum ${e.fullName}, here is your class link for ${e.course.title}: ${e.course.meetingLink}`;
    window.open(waLink(e.whatsapp, text), "_blank", "noopener,noreferrer");
    update(e, { meetLinkSent: true });
  }

  const filtered = !!(courseId || status || paymentStatus || q);
  return (
    <>
      <PageHeader title="Enrollments" desc="Enrollment requests and paid enrollments. Contains private contact details." />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="a-input" type="search" placeholder="Search name, WhatsApp or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select className="a-input" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {(courses.data || []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="a-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="a-input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} aria-label="Payment status">
          <option value="">All payment statuses</option>{PAYMENT_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>{filtered ? "No enrollments match these filters." : "No enrollments yet."}</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((e) => (
            <li key={e.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" className="min-w-0 flex-1 basis-48 text-left" onClick={() => setSelectedId(e.id)}>
                  <p dir="auto" className="text-sm font-semibold">{e.fullName}</p>
                  <p dir="auto" className="text-xs text-ad-mute">{e.course?.title || "Deleted course"} · {formatDate(e.createdAt)}</p>
                  <p className="text-xs text-ad-mute" dir="ltr">{e.whatsapp}</p>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.status} />
                  <span className="text-xs text-ad-mute">Payment</span><StatusBadge status={e.paymentStatus} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(NEXT[e.status] || []).filter((s) => s !== "pending").map((s) => (
                  <button key={s} className={s === "approved" ? "a-btn-primary" : "a-btn"} onClick={() => changeStatus(e, s)}>{ACTION_LABEL[s]}</button>
                ))}
                <button className="a-btn" onClick={() => setSelectedId(e.id)}><Icon name="eye" size={14} />Details</button>
                <a className="a-btn" href={waLink(e.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} />WhatsApp</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {selected && <Details e={selected} onAction={changeStatus} onSendLink={sendMeetLink} onClose={() => setSelectedId(null)} />}
      {dialog}
    </>
  );
}
