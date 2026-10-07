import { timingSafeEqual } from "../../utils/password.js";

/**
 * Razorpay integration — plain `fetch` + WebCrypto, no SDK (works in a
 * Worker without extra dependencies).
 *
 * Credentials come only from Worker secrets (RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) via loadConfig(). Until
 * they are set, getRazorpay() throws a 503 and nothing else breaks.
 * Secrets are never logged or returned to clients (only the publishable
 * key id goes to the checkout widget, which is how Razorpay Checkout works).
 */

const API_BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** @returns {{ keyId: string, keySecret: string }} */
export function getRazorpay(config) {
  const { keyId, keySecret } = config.razorpay || {};
  if (!keyId || !keySecret) throw fail("Online payments are not available right now.", 503, "PAYMENTS_NOT_CONFIGURED");
  return { keyId, keySecret };
}

export function getWebhookSecret(config) {
  const secret = config.razorpay?.webhookSecret;
  if (!secret) throw fail("Webhook is not configured.", 503, "PAYMENTS_NOT_CONFIGURED");
  return secret;
}

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(message) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckoutSignature(config, { orderId, paymentId, signature }) {
  const { keySecret } = getRazorpay(config);
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return typeof signature === "string" && timingSafeEqual(expected, signature.toLowerCase());
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret) in X-Razorpay-Signature. */
export async function verifyWebhookSignature(config, rawBody, signature) {
  const secret = getWebhookSecret(config);
  if (typeof signature !== "string" || !signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

async function razorpayFetch(config, path, init = {}) {
  const { keyId, keySecret } = getRazorpay(config);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw fail("Could not reach the payment gateway. Please try again.", 502, "PAYMENT_GATEWAY_ERROR");
  }

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }

  if (!res.ok) {
    // Log only Razorpay's own error code/description — never headers, keys or request bodies.
    console.error("Razorpay API error:", res.status, body?.error?.code || "", body?.error?.description || "");
    throw fail("The payment gateway rejected the request. Please try again later.", 502, "PAYMENT_GATEWAY_ERROR");
  }
  return body;
}

/** @param {{ amount: number, currency: string, receipt: string, notes?: object }} order  amount in paise */
export function createRazorpayOrder(config, { amount, currency, receipt, notes }) {
  return razorpayFetch(config, "/orders", {
    method: "POST",
    body: JSON.stringify({ amount, currency, receipt, notes: notes || {} }),
  });
}

export function fetchRazorpayPayment(config, paymentId) {
  return razorpayFetch(config, `/payments/${encodeURIComponent(paymentId)}`);
}
