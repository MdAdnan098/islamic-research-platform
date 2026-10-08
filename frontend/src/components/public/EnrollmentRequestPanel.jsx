import { useState } from "react";
import { publicApi } from "../../services/public.js";

/**
 * Enrollment REQUEST form (no payment). The browser only sends name / WhatsApp / email; the server
 * creates the record as pending + unpaid and nothing here can change either.
 */

const CLOSED_MESSAGE = {
  coming_soon: "Enrollment has not opened yet. Please check back soon.",
  enrollment_closed: "Enrollment for this course is closed.",
  completed: "This course has been completed.",
};

function Notice({ tone = "info", children }) {
  const cls = tone === "error" ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300" : "border-rule bg-soft text-ink";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

const inputCls = "mt-1 w-full rounded-lg border border-rule bg-field px-3 py-2.5 text-base";

export function EnrollmentRequestPanel({ course }) {
  const [form, setForm] = useState({ fullName: "", whatsapp: "", email: "" });
  const [stage, setStage] = useState("idle"); // idle | submitting | done
  const [error, setError] = useState("");

  if (course.status !== "enrollment_open") return <Notice>{CLOSED_MESSAGE[course.status] || "Enrollment is not available."}</Notice>;
  if (stage === "done") return <Notice>Your enrollment request has been received. We will review it and contact you on WhatsApp.</Notice>;

  async function submit(e) {
    e.preventDefault();
    setError("");
    const name = form.fullName.trim();
    const digits = form.whatsapp.replace(/\D/g, "");
    if (name.length < 2) return setError("Please enter your full name.");
    if (digits.length < 8 || digits.length > 15) return setError("Please enter a valid WhatsApp number with country code.");
    setStage("submitting");
    try {
      await publicApi.enrollmentRequest(course.id, { fullName: name, whatsapp: form.whatsapp.trim(), email: form.email.trim() || undefined });
      setStage("done");
    } catch (err) {
      // Already requested = the student's goal is met; anything else stays on the form.
      if (err.code === "ALREADY_ENROLLED") { setError(""); setStage("done"); return; }
      setError(err.message || "Could not submit your request. Please try again.");
      setStage("idle");
    }
  }

  const busy = stage === "submitting";
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label className="block text-sm font-medium">Full name
        <input className={inputCls} dir="auto" autoComplete="name" required maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} disabled={busy} />
      </label>
      <label className="block text-sm font-medium">WhatsApp number
        <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required maxLength={30} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={busy} />
      </label>
      <label className="block text-sm font-medium">Email <span className="font-normal text-mute">(optional)</span>
        <input className={inputCls} type="email" inputMode="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={busy} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? "Submitting…" : "Request enrollment"}</button>
      <p className="text-center text-xs text-mute">No payment is taken now. We will contact you on WhatsApp after reviewing your request.</p>
    </form>
  );
}
