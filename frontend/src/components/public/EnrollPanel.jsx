import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "../../config/env.js";
import { publicApi } from "../../services/public.js";
import { loadRazorpay } from "../../lib/razorpay.js";
import { formatPrice } from "../../lib/format.js";

/**
 * Enrollment flow for one course:
 *   Enroll → server creates order → Razorpay checkout → server verifies the
 *   payment → enrollment form → submit.
 *
 * The browser never decides that a payment succeeded: "paid" only ever
 * comes from the server (verify / status endpoints), and the enrollment
 * endpoint re-checks it again. The order id + claim token are kept in
 * localStorage so a refresh or closed tab after paying can still resume.
 */

const claimKey = (courseId) => `fs_enroll:${courseId}`;
function readClaim(courseId) {
  try { return JSON.parse(localStorage.getItem(claimKey(courseId)) || "null"); } catch { return null; }
}
function saveClaim(courseId, claim) {
  try { localStorage.setItem(claimKey(courseId), JSON.stringify(claim)); } catch { /* storage unavailable */ }
}
function clearClaim(courseId) {
  try { localStorage.removeItem(claimKey(courseId)); } catch { /* ignore */ }
}

const CLOSED_MESSAGE = {
  coming_soon: "Enrollment has not opened yet. Please check back soon.",
  enrollment_closed: "Enrollment for this course is closed.",
  completed: "This course has been completed.",
};

function Notice({ tone = "info", children }) {
  const cls = tone === "error" ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300" : "border-rule bg-soft text-ink";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

export function EnrollPanel({ course }) {
  const [stage, setStage] = useState("loading"); // loading | idle | opening | verifying | pending | form | submitting | done
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", whatsapp: "", email: "" });
  const claimRef = useRef(null);
  const open = course.status === "enrollment_open";

  const checkStatus = useCallback(async () => {
    const claim = readClaim(course.id);
    if (!claim?.orderId || !claim?.claimToken) { setStage("idle"); return; }
    claimRef.current = claim;
    try {
      const s = await publicApi.paymentStatus(claim);
      if (s.status === "paid" && s.enrolled) { clearClaim(course.id); setStage("done"); }
      else if (s.status === "paid") setStage("form");
      else if (s.status === "pending") setStage("pending");
      else { clearClaim(course.id); setStage("idle"); } // created / failed / refunded: start fresh
    } catch (e) {
      if (e.status === 404) clearClaim(course.id);
      setStage("idle");
    }
  }, [course.id]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function startPayment() {
    setError("");
    setStage("opening");
    try {
      const [order, Razorpay] = await Promise.all([publicApi.createOrder(course.id), loadRazorpay()]);
      claimRef.current = { orderId: order.orderId, claimToken: order.claimToken };
      saveClaim(course.id, claimRef.current);

      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: BRAND.name,
        description: order.course.title,
        theme: { color: "#0f5132" },
        handler: (response) => confirmPayment(order, response),
        modal: { ondismiss: () => setStage((s) => (s === "opening" ? "idle" : s)) },
      });
      rzp.on("payment.failed", (resp) => {
        setError(resp?.error?.description || "The payment could not be completed. You have not been charged, or any charge will be refunded by your bank.");
        setStage("idle");
      });
      rzp.open();
    } catch (e) {
      setError(e.message || "Could not start the payment.");
      setStage("idle");
    }
  }

  async function confirmPayment(order, response) {
    setStage("verifying");
    setError("");
    try {
      const result = await publicApi.verifyPayment({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      });
      setStage(result.status === "paid" ? "form" : "pending");
    } catch (e) {
      // The payment may still have gone through (the server will also learn of it via webhook) — let them re-check.
      setError(e.message || "We could not confirm your payment yet.");
      setStage("pending");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStage("submitting");
    try {
      await publicApi.enroll(course.id, { ...claimRef.current, fullName: form.fullName, whatsapp: form.whatsapp, email: form.email || undefined });
      clearClaim(course.id);
      setStage("done");
    } catch (err) {
      if (err.code === "ALREADY_ENROLLED") { clearClaim(course.id); setStage("done"); return; }
      setError(err.message || "Could not submit your enrollment.");
      setStage("form");
    }
  }

  if (stage === "loading") return <p className="text-sm text-mute" aria-busy="true">Loading…</p>;
  if (stage === "done") return <Notice>Your enrollment has been received. We will contact you on WhatsApp with the class details.</Notice>;

  if (stage === "form" || stage === "submitting") {
    return (
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Notice>Payment received. Please complete your enrollment.</Notice>
        <label className="block text-sm font-medium">Full name
          <input className="mt-1 w-full rounded-lg border border-rule bg-field px-3 py-2.5 text-base" dir="auto" autoComplete="name" required maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">WhatsApp number
          <input className="mt-1 w-full rounded-lg border border-rule bg-field px-3 py-2.5 text-base" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required maxLength={30} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">Email <span className="font-normal text-mute">(optional)</span>
          <input className="mt-1 w-full rounded-lg border border-rule bg-field px-3 py-2.5 text-base" type="email" inputMode="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full justify-center" disabled={stage === "submitting"}>{stage === "submitting" ? "Submitting…" : "Complete enrollment"}</button>
      </form>
    );
  }

  if (stage === "pending" || stage === "verifying") {
    return (
      <div className="space-y-3">
        <Notice>{stage === "verifying" ? "Confirming your payment…" : "Your payment is still being confirmed. This can take a few minutes."}</Notice>
        {error && <Notice tone="error">{error}</Notice>}
        {stage === "pending" && <button className="btn-outline w-full justify-center" onClick={checkStatus}>Check again</button>}
      </div>
    );
  }

  // idle | opening
  if (!open) return <Notice>{CLOSED_MESSAGE[course.status] || "Enrollment is not available."}</Notice>;
  return (
    <div className="space-y-3">
      <button className="btn-primary w-full justify-center" onClick={startPayment} disabled={stage === "opening"}>
        {stage === "opening" ? "Opening payment…" : `Enroll — ${formatPrice(course.price, course.currency)}`}
      </button>
      <p className="text-center text-xs text-mute">Secure payment by Razorpay. After paying you will fill in a short enrollment form.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
