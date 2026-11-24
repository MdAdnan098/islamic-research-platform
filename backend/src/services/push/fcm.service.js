/**
 * Firebase Cloud Messaging (HTTP v1) sender for the Cloudflare Worker. Uses only fetch + WebCrypto - no Firebase Admin SDK.
 *
 * SECRET HANDLING: the Firebase service account JSON lives ONLY in the Worker secret FIREBASE_SERVICE_ACCOUNT. It is parsed
 * here, used to sign a short-lived OAuth token request, and never logged, returned by any API or sent to a browser / app.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Parses and checks the secret. Returns null when it is missing or unusable (push is then simply "not configured"). */
export function parseServiceAccount(raw) {
  if (!raw || typeof raw !== "string") return null;
  let json;
  try { json = JSON.parse(raw); } catch { return null; }
  if (!json || typeof json !== "object") return null;
  const { client_email: clientEmail, private_key: privateKey, project_id: projectId } = json;
  if (typeof clientEmail !== "string" || typeof privateKey !== "string" || typeof projectId !== "string") return null;
  if (!clientEmail.includes("@") || !privateKey.includes("BEGIN PRIVATE KEY") || !/^[a-z0-9-]{4,64}$/i.test(projectId)) return null;
  return { clientEmail, privateKey, projectId };
}

const b64url = (input) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function pemToDer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** RS256-signed JWT assertion for Google's OAuth token endpoint. Exported for the tests. */
export async function signServiceAccountJwt(account, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(account.privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(signature)}`;
}

// Access tokens last an hour; one is reused by every request that lands on the same warm isolate.
let cached = null; // { key, token, expiresAt }
export function _resetFcmCacheForTests() { cached = null; }

export async function getAccessToken(account, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (cached && cached.key === account.clientEmail && cached.expiresAt - 5 * 60 * 1000 > now) return cached.token;
  const assertion = await signServiceAccountJwt(account, Math.floor(now / 1000));
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.access_token) {
    const err = new Error("Could not get a Google access token for Firebase (check the service account secret).");
    err.code = "FCM_AUTH_FAILED";
    throw err;
  }
  cached = { key: account.clientEmail, token: json.access_token, expiresAt: now + (Number(json.expires_in) || 3600) * 1000 };
  return cached.token;
}

/**
 * Maps an FCM error response to what the dispatcher should do:
 *   invalidToken - the device token is dead (app uninstalled / token expired): delete it.
 *   retry        - temporary (FCM unavailable, quota): try again, never delete.
 *   fatal        - configuration problem (wrong project, bad credentials): never delete tokens because of it.
 */
export function classifyFcmError(status, json) {
  const err = json?.error || {};
  const details = Array.isArray(err.details) ? err.details : [];
  const fcmCode = details.map((d) => d?.errorCode).find(Boolean) || "";
  const text = String(err.message || "");
  const code = fcmCode || String(err.status || `HTTP_${status}`);
  if (fcmCode === "UNREGISTERED" || (status === 404 && /not found|registration token/i.test(text) && fcmCode !== "SENDER_ID_MISMATCH")) {
    return { kind: "invalidToken", code: "UNREGISTERED" };
  }
  // INVALID_ARGUMENT is also returned for a bad payload; only a message about the token itself means the token is bad.
  if (fcmCode === "INVALID_ARGUMENT" || err.status === "INVALID_ARGUMENT") {
    return /registration token|not a valid fcm/i.test(text) ? { kind: "invalidToken", code: "INVALID_TOKEN" } : { kind: "fatal", code };
  }
  if (status === 401 || status === 403 || fcmCode === "SENDER_ID_MISMATCH" || err.status === "PERMISSION_DENIED" || err.status === "UNAUTHENTICATED") return { kind: "fatal", code };
  if (status === 429 || status >= 500 || ["UNAVAILABLE", "INTERNAL", "QUOTA_EXCEEDED"].includes(fcmCode) || ["UNAVAILABLE", "INTERNAL", "RESOURCE_EXHAUSTED"].includes(err.status)) return { kind: "retry", code };
  return { kind: "fatal", code };
}

/**
 * Sends one message. Resolves to { ok: true } or { ok: false, kind, code }. Never throws for an FCM / network problem and
 * never puts the token or any credential into the result.
 */
export async function sendMessage(account, body, { fetchImpl = fetch, accessToken } = {}) {
  let token = accessToken;
  try {
    token ||= await getAccessToken(account, { fetchImpl });
  } catch (e) {
    return { ok: false, kind: "fatal", code: e.code || "FCM_AUTH_FAILED" };
  }
  let res;
  try {
    res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: "retry", code: "NETWORK" };
  }
  if (res.ok) {
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    return { ok: true };
  }
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  // An expired / revoked access token: forget it so the next attempt asks Google for a new one.
  if (res.status === 401) cached = null;
  return { ok: false, ...classifyFcmError(res.status, json) };
}
