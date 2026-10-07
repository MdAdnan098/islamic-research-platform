import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { Empty, ErrorBox, PageHeader, Spinner, StatusBadge } from "../components/ui.jsx";

export default function Payments() {
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const courses = useAsync((s) => adminApi.courses.list({}, s), []);
  const { data, error, loading, reload } = useAsync((s) => adminApi.payments.list({ courseId, status, limit: 200 }, s), [courseId, status]);

  return (
    <>
      <PageHeader title="Payments" desc="Payment records for course orders. Refunds are issued from the Razorpay dashboard and appear here automatically.">
        <select className="a-input !w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {(courses.data || []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="a-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {["created", "pending", "paid", "failed", "refunded"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </PageHeader>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty>No payments yet.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p dir="auto" className="truncate text-sm font-medium">{p.course?.title || "Deleted course"}</p>
                <p className="break-all text-xs text-ad-mute">{p.orderId}{p.paymentId ? ` · ${p.paymentId}` : ""}</p>
              </div>
              <span className="text-sm font-semibold">{formatPrice(p.amount / 100, p.currency)}</span>
              <StatusBadge status={p.status} />
              <span className="text-xs text-ad-mute">{formatDate(p.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
