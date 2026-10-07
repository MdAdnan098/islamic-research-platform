import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { Empty, ErrorBox, PageHeader, Spinner, StatusBadge, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const waLink = (number, text) => `https://wa.me/${String(number).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export default function Enrollments() {
  const toast = useToast();
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const courses = useAsync((s) => adminApi.courses.list({}, s), []);
  const { data, error, loading, reload, setData } = useAsync((s) => adminApi.enrollments.list({ courseId, status, limit: 200 }, s), [courseId, status]);

  async function update(e, body) {
    try {
      const saved = await adminApi.enrollments.update(e.id, body);
      setData((list) => list.map((x) => (x.id === e.id ? { ...x, status: saved.status, meetLinkSentAt: saved.meetLinkSentAt } : x)));
    } catch (err) { toast(err.message, "error"); }
  }
  /** Opens WhatsApp with the Meet link pre-filled (the link only ever travels admin → student), then records that it was sent. */
  function sendMeetLink(e) {
    const text = `Assalamu alaikum ${e.fullName}, here is your class link for ${e.course.title}: ${e.course.meetingLink}`;
    window.open(waLink(e.whatsapp, text), "_blank", "noopener,noreferrer");
    update(e, { meetLinkSent: true });
  }

  return (
    <>
      <PageHeader title="Enrollments" desc="Students who completed payment and submitted the enrollment form. Contains private contact details.">
        <select className="a-input !w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {(courses.data || []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="a-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
        </select>
      </PageHeader>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>No enrollments yet.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((e) => (
            <li key={e.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p dir="auto" className="text-sm font-semibold">{e.fullName}</p>
                  <p dir="auto" className="text-xs text-ad-mute">{e.course?.title || "Deleted course"} · {formatDate(e.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ad-mute">Payment</span><StatusBadge status={e.payment?.status || "created"} />
                  {e.payment && <span className="text-xs text-ad-mute">{formatPrice(e.payment.amount / 100, e.payment.currency)}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <a className="a-btn" href={`tel:${e.whatsapp}`}>{e.whatsapp}</a>
                <a className="a-btn" href={waLink(e.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} />WhatsApp</a>
                {e.email && <a className="a-btn" href={`mailto:${e.email}`}>{e.email}</a>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="a-input !w-auto" value={e.status} onChange={(ev) => update(e, { status: ev.target.value })} aria-label="Enrollment status">
                  <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
                </select>
                {e.course?.meetingLink ? (
                  <button className="a-btn" onClick={() => sendMeetLink(e)} disabled={e.payment?.status !== "paid"}>
                    {e.meetLinkSentAt ? `Meet link sent ${formatDate(e.meetLinkSentAt)} — send again` : "Send Meet link on WhatsApp"}
                  </button>
                ) : <span className="text-xs text-ad-mute">No Meet link set for this course.</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
