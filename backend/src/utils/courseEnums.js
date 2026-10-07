/**
 * Controlled vocabularies for the live-session / course / payment /
 * enrollment modules. Kept separate from contentEnums.js so the existing
 * content vocabularies stay untouched.
 */

export const LIVE_STATUSES = ["scheduled", "live", "ended"];

export const COURSE_STATUSES = ["draft", "coming_soon", "enrollment_open", "enrollment_closed", "completed"];
export const MEETING_PROVIDERS = ["google_meet"];
/** Extensible: add a code here (and make sure Razorpay supports it) to sell in another currency. */
export const CURRENCIES = ["INR"];

export const PAYMENT_STATUSES = ["created", "pending", "paid", "failed", "refunded"];
export const PAYMENT_GATEWAYS = ["razorpay"];

export const ENROLLMENT_STATUSES = ["pending", "confirmed", "cancelled"];
