import { getDb } from "./mongo.service.js";

/**
 * Read-only numbers for the admin dashboard home. Only counts: nothing here writes, and the enrollment /
 * payment / live-session services themselves are untouched (the collections are just counted).
 *
 * "enrollments" counts what the admin Enrollments page lists by default (paid / refunded enrollments).
 */
export async function getDashboardCounts(config) {
  const db = await getDb(config);
  const enrollments = db.collection("enrollments");
  const payments = db.collection("payments");
  const sessions = db.collection("live_sessions");

  const visibleEnrollments = { $or: [{ paymentStatus: { $in: ["paid", "refunded"] } }, { paymentId: { $type: "objectId" } }] };
  const [enrollTotal, enrollPending, payTotal, payPaid, liveTotal, liveNow, liveUpcoming] = await Promise.all([
    enrollments.countDocuments(visibleEnrollments),
    enrollments.countDocuments({ $and: [visibleEnrollments, { status: "pending" }] }),
    payments.countDocuments({}),
    payments.countDocuments({ status: "paid" }),
    sessions.countDocuments({}),
    sessions.countDocuments({ status: "live" }),
    sessions.countDocuments({ status: "scheduled" }),
  ]);

  return {
    enrollments: { total: enrollTotal, pending: enrollPending },
    payments: { total: payTotal, paid: payPaid },
    liveSessions: { total: liveTotal, live: liveNow, upcoming: liveUpcoming },
  };
}
