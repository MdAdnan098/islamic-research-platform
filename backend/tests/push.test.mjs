// Run: cd backend && node --test tests/push.test.mjs
// Phase 3 (push notifications): rules, the FCM sender, device registration, the admin API (authorization, sending, history,
// duplicate prevention), chunked sending and the automatic events - all through the real Worker entry point with an
// in-memory stand-in for MongoDB and a fake FCM server. No database, network, Firebase project or secret is needed;
// the RSA key used as the "service account" is generated while the tests run and is never written anywhere.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";

/* ------------------------- in-memory MongoDB stand-in ------------------------- */
const store = {};
const rows = (name) => (store[name] ||= []);
const getPath = (path, doc) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), doc);
const norm = (v) => (v instanceof Date ? v.getTime() : v instanceof ObjectId ? String(v) : v);
const same = (a, b) => (b === null ? a == null : norm(a) === norm(b));
const cmp = (a, b) => (norm(a) < norm(b) ? -1 : norm(a) > norm(b) ? 1 : 0);
const isOps = (c) => c && typeof c === "object" && !(c instanceof Date) && !(c instanceof ObjectId) && !Array.isArray(c) && Object.keys(c).some((k) => k.startsWith("$"));
function matchValue(actual, cond) {
  if (!isOps(cond)) return same(actual, cond);
  return Object.entries(cond).every(([op, v]) => {
    if (op === "$ne") return !same(actual, v);
    if (op === "$in") return v.some((x) => same(actual, x));
    if (op === "$nin") return !v.some((x) => same(actual, x));
    if (op === "$gt") return actual !== undefined && actual !== null && cmp(actual, v) > 0;
    if (op === "$lt") return actual !== undefined && actual !== null && cmp(actual, v) < 0;
    if (op === "$type") return typeof actual === "string";
    throw new Error(`stand-in: unsupported operator ${op}`);
  });
}
const matches = (doc, q) => Object.entries(q).every(([k, c]) => (k === "$or" ? c.some((s) => matches(doc, s)) : matchValue(getPath(k, doc), c)));
function setPath(doc, path, value) {
  const keys = path.split(".");
  let o = doc;
  for (const k of keys.slice(0, -1)) o = o[k] ||= {};
  o[keys.at(-1)] = value;
}
function apply(doc, update, inserting) {
  for (const [k, v] of Object.entries(update.$set || {})) setPath(doc, k, v);
  if (inserting) for (const [k, v] of Object.entries(update.$setOnInsert || {})) setPath(doc, k, v);
  for (const [k, v] of Object.entries(update.$inc || {})) setPath(doc, k, (getPath(k, doc) || 0) + v);
  for (const k of Object.keys(update.$unset || {})) delete doc[k];
}
// The real driver hands out copies, never the stored object itself.
const clone = (v) => (v instanceof Date ? new Date(v) : Array.isArray(v) ? v.map(clone) : v && typeof v === "object" && !(v instanceof ObjectId) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const collection = (name) => ({
  async findOne(q) { const d = rows(name).find((x) => matches(x, q)); return d ? clone(d) : null; },
  find(q = {}) {
    let list = rows(name).filter((d) => matches(d, q));
    const cursor = {
      sort(s) { const [[k, dir]] = Object.entries(s); list = [...list].sort((a, b) => dir * cmp(getPath(k, a), getPath(k, b))); return cursor; },
      limit(n) { list = list.slice(0, n); return cursor; },
      async toArray() { return list.map(clone); },
    };
    return cursor;
  },
  async countDocuments(q = {}) { return rows(name).filter((d) => matches(d, q)).length; },
  async insertOne(doc) { const d = { _id: new ObjectId(), ...doc }; rows(name).push(d); return { insertedId: d._id }; },
  async updateOne(q, update, opts = {}) {
    let d = rows(name).find((x) => matches(x, q));
    let inserting = false;
    if (!d && opts.upsert) {
      d = { _id: new ObjectId() };
      for (const [k, v] of Object.entries(q)) if (!k.startsWith("$") && !isOps(v)) d[k] = v;
      rows(name).push(d);
      inserting = true;
    }
    if (d) apply(d, update, inserting);
    return { matchedCount: d && !inserting ? 1 : 0, modifiedCount: d ? 1 : 0, upsertedId: inserting ? d._id : undefined };
  },
  async deleteOne(q) { const i = rows(name).findIndex((d) => matches(d, q)); if (i >= 0) rows(name).splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
  async deleteMany(q) { const keep = rows(name).filter((d) => !matches(d, q)); const n = rows(name).length - keep.length; store[name] = keep; return { deletedCount: n }; },
  async createIndex() {},
});
MongoClient.prototype.connect = async function connect() { return this; };
MongoClient.prototype.db = () => ({ collection, command: async () => ({ ok: 1 }) });

/* ---------------------- fake FCM server (replaces fetch) ---------------------- */
let sent = []; // { token, message }
let tokenRequests = 0;
let fcmReply = () => ({ status: 200, body: { name: "projects/x/messages/1" } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === "https://oauth2.googleapis.com/token") {
    tokenRequests += 1;
    return new Response(JSON.stringify({ access_token: "ya29.test-access-token", expires_in: 3600 }), { status: 200 });
  }
  if (u.startsWith("https://fcm.googleapis.com/v1/projects/")) {
    assert.equal(init.headers.Authorization, "Bearer ya29.test-access-token");
    const body = JSON.parse(init.body);
    sent.push({ token: body.message.token, message: body.message, url: u });
    const r = fcmReply(body.message.token, sent.length);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }
  throw new Error(`unexpected network call in test: ${u}`);
};

const { default: worker } = await import("../src/index.js");
const { signJwt } = await import("../src/utils/jwt.js");
const { ADMIN_SESSION_COOKIE } = await import("../src/utils/cookies.js");
const { _resetAuthLimiterForTests } = await import("../src/middleware/rateLimit.js");
const { _resetPushControllerForTests } = await import("../src/controllers/push.controller.js");
const P = await import("../src/utils/push.js");
const F = await import("../src/services/push/fcm.service.js");
const E = await import("../src/services/push/events.js");
const { loadConfig } = await import("../src/config/env.js");

/* --------------------------- runtime-only credentials --------------------------- */
const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
const PEM = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const SERVICE_ACCOUNT = JSON.stringify({ client_email: "svc@atharitv-test.iam.gserviceaccount.com", private_key: PEM, project_id: "atharitv-test" });
const JWT_SECRET = `${crypto.randomUUID()}${crypto.randomUUID()}`;

const baseEnv = (extra = {}) => ({ MONGODB_URI: "mongodb://localhost/unused", MONGODB_DB_NAME: "t", ADMIN_JWT_SECRET: JWT_SECRET, ENVIRONMENT: "production", ALLOWED_ORIGIN: "https://site.example", FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT, ...extra });

let ip = 0;
const call = (path, { method = "GET", body, env = baseEnv(), cookie } = {}) =>
  worker.fetch(
    new Request(`https://api.example${path}`, {
      method,
      headers: { "CF-Connecting-IP": `203.0.113.${(++ip % 250) + 1}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil() {} }
  );
const json = async (res) => res.json();

async function adminCookie() {
  const _id = new ObjectId();
  rows("admins").push({ _id, username: "tester", role: "admin", active: true, createdAt: new Date() });
  const token = await signJwt({ sub: String(_id), username: "tester", role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 });
  return `${ADMIN_SESSION_COOKIE}=${token}`;
}

const tok = (n, tag = "A") => `${tag}${String(n).padStart(8, "0")}:APA91b${"x".repeat(60)}-_${n}`;
const register = (token, platform = "android", extra = {}) => call("/api/public/push/register", { method: "POST", body: { platform, token, ...extra } });
const goodNote = (over = {}) => ({ title: "Naya mazmoon", body: "Parhne ke liye tap karein", category: "posts", platforms: ["android", "web"], link: "/article/test", ...over });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  sent = []; tokenRequests = 0; ip = 0;
  fcmReply = () => ({ status: 200, body: { name: "projects/x/messages/1" } });
  F._resetFcmCacheForTests();
  _resetAuthLimiterForTests();
  _resetPushControllerForTests();
});

/* ================================== rules ================================== */
test("sanitizeLink: only pages of this website; no other host, no admin, no script / protocol tricks", () => {
  const site = "https://atharitv-website.pages.dev";
  assert.equal(P.sanitizeLink("/article/abc", site), "/article/abc");
  assert.equal(P.sanitizeLink("/courses/x?y=1#z", site), "/courses/x?y=1#z");
  assert.equal(P.sanitizeLink("https://atharitv-website.pages.dev/live", site), "/live");
  assert.equal(P.sanitizeLink("", site), "");
  assert.equal(P.sanitizeLink(undefined, site), "");
  for (const bad of ["https://evil.example/x", "//evil.example", "javascript:alert(1)", "data:text/html,x", "/admin", "/admin/articles", "article/x", "/a\\b", "/a\nb", "http://atharitv-website.pages.dev/x", "https://user:pw@atharitv-website.pages.dev/x", "/" + "a".repeat(600), 5, {}]) {
    assert.equal(P.sanitizeLink(bad, site), null, String(bad));
  }
  assert.equal(P.sanitizeLink("https://atharitv-website.pages.dev/live", ""), null, "no site origin configured -> full URLs refused");
});

test("registration validation: platform, token shape, installId, prefs", () => {
  assert.equal(P.validateRegistration({ platform: "android", token: tok(1) }).errors.length, 0);
  for (const bad of [{}, { platform: "ios", token: tok(1) }, { platform: "web" }, { platform: "web", token: "short" }, { platform: "web", token: `${tok(1)} <script>` }, { platform: "web", token: tok(1), installId: "x" }, { platform: "web", token: tok(1), prefs: "yes" }]) {
    assert.ok(P.validateRegistration(bad).errors.length > 0, JSON.stringify(bad).slice(0, 60));
  }
  const prefs = P.validateRegistration({ platform: "web", token: tok(2), prefs: { posts: false, hacker: true, live: "no" } }).value.prefs;
  assert.deepEqual(prefs, { enabled: true, posts: false, courses: true, live: true, announcements: true });
});

test("notification validation: required fields, limits, category, platforms, link", () => {
  const ok = P.validateNotificationInput(goodNote(), { siteOrigin: "https://site.example" });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.value.link, "/article/test");
  for (const bad of [goodNote({ title: "  " }), goodNote({ body: "" }), goodNote({ title: "x".repeat(101) }), goodNote({ body: "x".repeat(301) }), goodNote({ category: "spam" }), goodNote({ platforms: [] }), goodNote({ platforms: ["ios"] }), goodNote({ link: "https://evil.example" }), goodNote({ clientRequestId: "bad id" })]) {
    assert.ok(P.validateNotificationInput(bad, { siteOrigin: "https://site.example" }).errors.length > 0);
  }
});

test("FCM messages: Android = notification + data (system tray when closed); web = data only (service worker shows it)", () => {
  const n = { id: "abc", title: "T", body: "B", link: "/live", category: "live", kind: "liveStart" };
  const a = P.buildFcmMessage({ platform: "android", token: "tok", notification: n });
  assert.deepEqual(a.message.notification, { title: "T", body: "B" });
  assert.equal(a.message.android.notification.channel_id, "atharitv_default");
  assert.equal(a.message.android.priority, "HIGH");
  assert.equal(a.message.android.ttl, "3600s");
  const w = P.buildFcmMessage({ platform: "web", token: "tok", notification: { ...n, kind: "post", category: "posts" }, iconUrl: "https://x/i.png" });
  assert.equal(w.message.notification, undefined);
  assert.equal(w.message.data.title, "T");
  assert.equal(w.message.webpush.headers.TTL, String(2 * 24 * 3600));
  for (const m of [a, w]) for (const [k, v] of Object.entries(m.message.data)) assert.equal(typeof v, "string", `data.${k} must be a string`);
});

/* ============================= service account / FCM ============================= */
test("service account: parsed only when complete; JWT is a valid RS256 signature", async () => {
  assert.equal(F.parseServiceAccount(""), null);
  assert.equal(F.parseServiceAccount("not json"), null);
  assert.equal(F.parseServiceAccount(JSON.stringify({ client_email: "a@b", project_id: "p" })), null);
  const acc = F.parseServiceAccount(SERVICE_ACCOUNT);
  assert.equal(acc.projectId, "atharitv-test");
  const jwt = await F.signServiceAccountJwt(acc, 1_700_000_000);
  const [h, c, s] = jwt.split(".");
  const dec = (x) => JSON.parse(Buffer.from(x, "base64url").toString());
  assert.deepEqual(dec(h), { alg: "RS256", typ: "JWT" });
  assert.equal(dec(c).iss, acc.clientEmail);
  assert.equal(dec(c).scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.equal(dec(c).exp - dec(c).iat, 3600);
  assert.equal(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", kp.publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${c}`)), true);
});

test("classifyFcmError: dead token vs temporary vs configuration problem", () => {
  const e = (status, code, message = "m", st = "X") => F.classifyFcmError(status, { error: { code: status, message, status: st, details: [{ errorCode: code }] } });
  assert.equal(e(404, "UNREGISTERED").kind, "invalidToken");
  assert.equal(e(400, "INVALID_ARGUMENT", "The registration token is not a valid FCM registration token", "INVALID_ARGUMENT").kind, "invalidToken");
  assert.equal(e(400, "INVALID_ARGUMENT", "Invalid JSON payload", "INVALID_ARGUMENT").kind, "fatal", "a bad payload must NOT delete the token");
  assert.equal(e(403, "SENDER_ID_MISMATCH").kind, "fatal", "wrong Firebase project must NOT delete tokens");
  assert.equal(F.classifyFcmError(401, {}).kind, "fatal");
  assert.equal(e(503, "UNAVAILABLE").kind, "retry");
  assert.equal(F.classifyFcmError(500, null).kind, "retry");
  assert.equal(F.classifyFcmError(429, null).kind, "retry");
});

/* ============================ device registration ============================ */
test("public status: reports whether the server can send, nothing else", async () => {
  assert.deepEqual((await json(await call("/api/public/push/status"))).data, { enabled: true });
  assert.deepEqual((await json(await call("/api/public/push/status", { env: baseEnv({ FIREBASE_SERVICE_ACCOUNT: undefined }) }))).data, { enabled: false });
});

test("register: stores the device, never echoes the token, refresh keeps ONE record per install", async () => {
  const installId = "install-1234567890abcd";
  const r1 = await register(tok(1), "android", { installId });
  assert.equal(r1.status, 200);
  const body = await json(r1);
  assert.equal(body.data.registered, true);
  assert.ok(!JSON.stringify(body).includes(tok(1)), "token must not be returned");
  assert.equal(rows("push_devices").length, 1);
  assert.deepEqual(Object.keys(rows("push_devices")[0]).sort(), ["_id", "createdAt", "installId", "lastSeenAt", "platform", "prefs", "token"], "only these fields - no personal data");

  await register(tok(1), "android", { installId }); // same token again (app start)
  assert.equal(rows("push_devices").length, 1);

  await call("/api/public/push/preferences", { method: "PUT", body: { token: tok(1), prefs: { courses: false } } });
  await register(tok(2), "android", { installId }); // FCM rotated the token
  assert.equal(rows("push_devices").length, 1, "old token replaced");
  assert.equal(rows("push_devices")[0].token, tok(2));
  assert.equal(rows("push_devices")[0].prefs.courses, false, "preferences survive the token refresh");

  await register(tok(3), "web", { installId }); // same install id on another platform is a different device
  assert.equal(rows("push_devices").length, 2);
  await register(tok(4), "android", { installId: "install-other-0000000" }); // another phone of the same person
  assert.equal(rows("push_devices").length, 3);
});

test("register: validation errors, rate limit", async () => {
  assert.equal((await register("short")).status, 400);
  assert.equal((await call("/api/public/push/register", { method: "POST", body: { platform: "pc", token: tok(1) } })).status, 400);
  assert.equal((await call("/api/public/push/register", { method: "POST" })).status, 400);
  assert.equal(rows("push_devices").length, 0);
  let last;
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.9" };
  for (let i = 0; i < 61; i += 1) last = await worker.fetch(new Request("https://api.example/api/public/push/register", { method: "POST", headers, body: JSON.stringify({ platform: "web", token: tok(i) }) }), baseEnv(), { waitUntil() {} });
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("Retry-After"));
});

test("preferences + unregister need the device's own token; unknown tokens reveal nothing", async () => {
  await register(tok(1));
  const upd = await call("/api/public/push/preferences", { method: "PUT", body: { token: tok(1), prefs: { posts: false, enabled: true } } });
  assert.equal(upd.status, 200);
  assert.equal((await json(upd)).data.prefs.posts, false);
  assert.equal((await call("/api/public/push/preferences", { method: "PUT", body: { token: tok(99), prefs: { posts: false } } })).status, 404);
  assert.equal((await call("/api/public/push/preferences", { method: "PUT", body: { token: tok(1) } })).status, 400);
  assert.equal((await call("/api/public/push/unregister", { method: "POST", body: { token: tok(99) } })).status, 200); // same answer for unknown
  assert.equal(rows("push_devices").length, 1);
  assert.equal((await call("/api/public/push/unregister", { method: "POST", body: { token: tok(1) } })).status, 200);
  assert.equal(rows("push_devices").length, 0);
});

/* ================================ admin security ================================ */
test("admin notification API: anonymous, forged and deactivated sessions get 401; nothing is sent", async () => {
  const routes = [["GET", "/api/admin/notifications"], ["POST", "/api/admin/notifications"], ["PUT", "/api/admin/notifications/auto-settings"], ["POST", "/api/admin/notifications/000000000000000000000001/continue"]];
  await register(tok(1));
  for (const [method, path] of routes) {
    assert.equal((await call(path, { method, body: method === "GET" ? undefined : goodNote() })).status, 401, `${method} ${path} anonymous`);
    assert.equal((await call(path, { method, body: method === "GET" ? undefined : goodNote(), cookie: `${ADMIN_SESSION_COOKIE}=forged.token.value` })).status, 401, `${method} ${path} forged`);
  }
  const wrongSecret = await signJwt({ sub: String(new ObjectId()), username: "x", role: "admin" }, "another-secret-another-secret-123456", { expiresInSeconds: 600 });
  assert.equal((await call("/api/admin/notifications", { cookie: `${ADMIN_SESSION_COOKIE}=${wrongSecret}` })).status, 401);
  const cookie = await adminCookie();
  rows("admins")[0].active = false;
  assert.equal((await call("/api/admin/notifications", { cookie })).status, 401, "deactivated admin");
  assert.equal(sent.length, 0);
  assert.equal(rows("push_notifications").length, 0);
});

test("admin overview: history, device counts, settings; contains no token and no credential", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  await register(tok(2), "web");
  await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote() });
  const res = await call("/api/admin/notifications", { cookie });
  const text = await res.text();
  const data = JSON.parse(text).data;
  assert.equal(data.configured, true);
  assert.deepEqual(data.devices, { android: 1, web: 1 });
  assert.deepEqual(data.auto, { posts: true, courses: true, liveNew: true, liveStart: true });
  assert.equal(data.notifications.length, 1);
  for (const secret of [tok(1), tok(2), PEM.slice(40, 90), "svc@atharitv-test", "ya29.test-access-token", "private_key"]) assert.ok(!text.includes(secret), `leaked: ${secret.slice(0, 12)}`);
  assert.equal((await call("/api/admin/notifications", { cookie, env: baseEnv({ FIREBASE_SERVICE_ACCOUNT: undefined }) })).status, 200);
  assert.equal((await json(await call("/api/admin/notifications", { cookie, env: baseEnv({ FIREBASE_SERVICE_ACCOUNT: "garbage" }) }))).data.configured, false);
});

/* ================================== sending ================================== */
test("admin send: reaches both platforms with the right payload, history shows success counts", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  await register(tok(2), "web");
  const res = await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote() });
  assert.equal(res.status, 201);
  const n = (await json(res)).data.notification;
  assert.equal(n.status, "completed");
  assert.equal(n.sent, 2); assert.equal(n.failed, 0);
  assert.deepEqual(n.byPlatform, { android: { sent: 1, failed: 0 }, web: { sent: 1, failed: 0 } });
  assert.equal(n.createdBy, "tester");
  assert.equal(tokenRequests, 1, "one OAuth exchange, reused for every device");
  const android = sent.find((s) => s.token === tok(1)).message;
  const web = sent.find((s) => s.token === tok(2)).message;
  assert.equal(android.notification.title, "Naya mazmoon");
  assert.equal(android.data.link, "/article/test");
  assert.equal(web.notification, undefined);
  assert.equal(web.data.link, "/article/test");
  assert.ok(sent.every((s) => s.url.includes("/projects/atharitv-test/messages:send")));
});

test("admin send: only the chosen platform; only devices that allow the category", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  await register(tok(2), "web");
  await register(tok(3), "android", { prefs: { posts: false } }); // posts off
  await register(tok(4), "android", { prefs: { enabled: false } }); // everything off
  await register(tok(5), "android");
  const res = await json(await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ platforms: ["android"] }) }));
  assert.deepEqual(sent.map((s) => s.token).sort(), [tok(1), tok(5)].sort());
  assert.deepEqual(res.data.notification.targeted, { android: 2, web: 0 });
  sent = [];
  await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ category: "courses", platforms: ["android", "web"] }) });
  assert.deepEqual(sent.map((s) => s.token).sort(), [tok(1), tok(2), tok(3), tok(5)].sort(), "tok(3) only switched posts off");
});

test("admin send: dead tokens are removed, temporary errors retried, failures counted", async () => {
  const cookie = await adminCookie();
  for (let i = 1; i <= 4; i += 1) await register(tok(i), "android");
  const attempts = {};
  fcmReply = (token) => {
    attempts[token] = (attempts[token] || 0) + 1;
    if (token === tok(2)) return { status: 404, body: { error: { code: 404, status: "NOT_FOUND", message: "Requested entity was not found.", details: [{ errorCode: "UNREGISTERED" }] } } };
    if (token === tok(3)) return attempts[token] === 1 ? { status: 503, body: { error: { code: 503, status: "UNAVAILABLE", message: "try later" } } } : { status: 200, body: {} };
    if (token === tok(4)) return { status: 503, body: { error: { code: 503, status: "UNAVAILABLE", message: "try later" } } };
    return { status: 200, body: {} };
  };
  const n = (await json(await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ platforms: ["android"] }) }))).data.notification;
  assert.equal(n.sent, 2, "tok1 + tok3 (after one retry)");
  assert.equal(n.failed, 2, "tok2 dead + tok4 still unavailable after the retry");
  assert.equal(n.removed, 1);
  assert.equal(n.status, "completed_with_errors");
  assert.deepEqual(rows("push_devices").map((d) => d.token).sort(), [tok(1), tok(3), tok(4)].sort(), "only the dead token was deleted");
  assert.equal(attempts[tok(4)], 2);
});

test("a wrong Firebase project / credentials stops at once, deletes NO token and says so", async () => {
  const cookie = await adminCookie();
  for (let i = 1; i <= 20; i += 1) await register(tok(i), "android");
  fcmReply = () => ({ status: 403, body: { error: { code: 403, status: "PERMISSION_DENIED", message: "SenderId mismatch", details: [{ errorCode: "SENDER_ID_MISMATCH" }] } } });
  const n = (await json(await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote() }))).data.notification;
  assert.equal(n.status, "failed");
  assert.equal(n.lastError, "SENDER_ID_MISMATCH");
  assert.equal(rows("push_devices").length, 20, "no device lost because the setup is wrong");
  assert.ok(sent.length <= 8, `stopped after the first group, sent ${sent.length}`);
});

test("send needs configuration (503), valid input (400), and is not repeated by a double click (409)", async () => {
  const cookie = await adminCookie();
  await register(tok(1));
  const noKey = baseEnv({ FIREBASE_SERVICE_ACCOUNT: undefined });
  assert.equal((await call("/api/admin/notifications", { method: "POST", cookie, env: noKey, body: goodNote() })).status, 503);
  assert.equal((await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ title: "" }) })).status, 400);
  assert.equal((await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ link: "https://evil.example/x" }) })).status, 400);
  assert.equal(rows("push_notifications").length, 0);
  const id = "req-0123456789abcdef";
  assert.equal((await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ clientRequestId: id }) })).status, 201);
  assert.equal((await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ clientRequestId: id }) })).status, 409);
  assert.equal(sent.length, 1, "the device got ONE notification");
  assert.equal(rows("push_notifications").length, 1);
});

test("a recorded notification with no devices completes with zero counts (nothing to fail)", async () => {
  const cookie = await adminCookie();
  const n = (await json(await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote() }))).data.notification;
  assert.equal(n.status, "completed");
  assert.deepEqual([n.sent, n.failed, n.targeted.android, n.targeted.web], [0, 0, 0, 0]);
});

test("chunked sending: the rest is sent by 'continue'; no device is notified twice; a finished notification is not resent", async () => {
  const cookie = await adminCookie();
  const env = baseEnv({ PUSH_BATCH_SIZE: "2" });
  for (let i = 1; i <= 5; i += 1) await register(tok(i), i % 2 ? "android" : "web");
  const first = (await json(await call("/api/admin/notifications", { method: "POST", cookie, env, body: goodNote() }))).data.notification;
  assert.equal(first.status, "sending");
  assert.equal(first.sent, 2);
  const second = (await json(await call(`/api/admin/notifications/${first.id}/continue`, { method: "POST", cookie, env }))).data.notification;
  assert.equal(second.sent, 4); assert.equal(second.status, "sending");
  const third = (await json(await call(`/api/admin/notifications/${first.id}/continue`, { method: "POST", cookie, env }))).data.notification;
  assert.equal(third.sent, 5); assert.equal(third.status, "completed");
  const again = (await json(await call(`/api/admin/notifications/${first.id}/continue`, { method: "POST", cookie, env }))).data.notification;
  assert.equal(again.sent, 5);
  assert.equal(sent.length, 5);
  assert.equal(new Set(sent.map((s) => s.token)).size, 5, "every device exactly once");
  assert.equal((await call("/api/admin/notifications/000000000000000000000fff/continue", { method: "POST", cookie, env })).status, 404);
});

test("two requests continuing at the same moment never send the same chunk twice (lease)", async () => {
  const cookie = await adminCookie();
  const env = baseEnv({ PUSH_BATCH_SIZE: "3" });
  for (let i = 1; i <= 7; i += 1) await register(tok(i));
  const first = (await json(await call("/api/admin/notifications", { method: "POST", cookie, env, body: goodNote() }))).data.notification;
  const results = await Promise.all([1, 2, 3].map(() => call(`/api/admin/notifications/${first.id}/continue`, { method: "POST", cookie, env })));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(new Set(sent.map((s) => s.token)).size, sent.length, "no duplicate delivery");
});

test("auto-settings: switch events on / off (validated)", async () => {
  const cookie = await adminCookie();
  const res = await call("/api/admin/notifications/auto-settings", { method: "PUT", cookie, body: { posts: false } });
  assert.deepEqual((await json(res)).data.auto, { posts: false, courses: true, liveNew: true, liveStart: true });
  assert.equal((await call("/api/admin/notifications/auto-settings", { method: "PUT", cookie, body: { posts: "no" } })).status, 400);
  assert.equal((await call("/api/admin/notifications/auto-settings", { method: "PUT", cookie, body: {} })).status, 400);
});

/* =============================== automatic events =============================== */
function addArticle(over = {}) {
  const _id = new ObjectId();
  rows("articles").push({ _id, title: "Namaz ke ahkaam", slug: "namaz-ke-ahkaam", status: "draft", excerpt: "", blocks: [{ type: "paragraph", text: "x" }], references: [], createdAt: new Date(), updatedAt: new Date(), ...over });
  return _id;
}

test("publishing a post: ONE notification with the post's own route; drafts, edits, unpublish/publish again do not notify", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  await register(tok(2), "web");
  const id = addArticle();
  // saving a draft is not an event
  await call(`/api/admin/articles/${id}`, { method: "PATCH", cookie, body: { title: "Namaz ke ahkaam (edit)" } });
  assert.equal(rows("push_notifications").length, 0);

  assert.equal((await call(`/api/admin/articles/${id}/publish`, { method: "POST", cookie, body: {} })).status, 200);
  assert.equal(rows("push_notifications").length, 1);
  const n = rows("push_notifications")[0];
  assert.equal(n.link, "/article/namaz-ke-ahkaam");
  assert.equal(n.category, "posts");
  assert.equal(n.source, "auto");
  assert.equal(sent.length, 2);

  // editing the live post and publishing the change again is a minor edit
  await call(`/api/admin/articles/${id}/publish`, { method: "POST", cookie, body: {} });
  // unpublish and publish again: same post, no second notification
  await call(`/api/admin/articles/${id}/unpublish`, { method: "POST", cookie, body: {} });
  await call(`/api/admin/articles/${id}/publish`, { method: "POST", cookie, body: {} });
  assert.equal(rows("push_notifications").length, 1);
  assert.equal(sent.length, 2, "no device was notified twice");
});

test("publish still works when push is off, not configured or failing; { notify:false } skips", async () => {
  const cookie = await adminCookie();
  await register(tok(1));
  const a = addArticle({ slug: "a", title: "A" });
  assert.equal((await call(`/api/admin/articles/${a}/publish`, { method: "POST", cookie, body: {}, env: baseEnv({ FIREBASE_SERVICE_ACCOUNT: undefined }) })).status, 200);
  assert.equal(rows("articles").find((x) => String(x._id) === String(a)).status, "published");
  assert.equal(rows("push_notifications").length, 0);

  const b = addArticle({ slug: "b", title: "B" });
  assert.equal((await call(`/api/admin/articles/${b}/publish`, { method: "POST", cookie, body: { notify: false } })).status, 200);
  assert.equal(rows("push_notifications").length, 0);

  await call("/api/admin/notifications/auto-settings", { method: "PUT", cookie, body: { posts: false } });
  const c = addArticle({ slug: "c", title: "C" });
  await call(`/api/admin/articles/${c}/publish`, { method: "POST", cookie, body: {} });
  assert.equal(rows("push_notifications").length, 0, "event switched off");
  await call("/api/admin/notifications/auto-settings", { method: "PUT", cookie, body: { posts: true } });

  fcmReply = () => ({ status: 500, body: {} });
  const d = addArticle({ slug: "d", title: "D" });
  assert.equal((await call(`/api/admin/articles/${d}/publish`, { method: "POST", cookie, body: {} })).status, 200, "FCM down must not fail the publish");
  assert.equal(rows("articles").find((x) => String(x._id) === String(d)).status, "published");
});

test("live sessions: new published session -> 'new live'; going live -> 'live started' once; recordings and drafts are silent", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  const future = new Date(Date.now() + 3600_000).toISOString();
  const create = (over) => call("/api/admin/live-sessions", { method: "POST", cookie, body: { youtubeVideoId: "dQw4w9WgXcQ", title: "Dars", scheduledStartTime: future, status: "scheduled", isPublished: true, ...over } });

  const draft = await json(await create({ isPublished: false }));
  assert.equal(rows("push_notifications").length, 0, "draft: silent");
  const id = draft.data.session.id;

  await call(`/api/admin/live-sessions/${id}`, { method: "PATCH", cookie, body: { title: "Dars (naya naam)" } });
  assert.equal(rows("push_notifications").length, 0, "minor edit: silent");

  await call(`/api/admin/live-sessions/${id}`, { method: "PATCH", cookie, body: { isPublished: true } });
  assert.deepEqual(rows("push_notifications").map((n) => n.kind), ["liveNew"]);
  assert.equal(rows("push_notifications")[0].link, "/live");

  await call(`/api/admin/live-sessions/${id}`, { method: "PATCH", cookie, body: { status: "live" } });
  assert.deepEqual(rows("push_notifications").map((n) => n.kind), ["liveNew", "liveStart"]);
  await call(`/api/admin/live-sessions/${id}`, { method: "PATCH", cookie, body: { status: "ended" } });
  await call(`/api/admin/live-sessions/${id}`, { method: "PATCH", cookie, body: { status: "live" } }); // flapping back to live
  assert.equal(rows("push_notifications").filter((n) => n.kind === "liveStart").length, 1, "never a second 'live started' for one session");

  await create({ youtubeVideoId: "aaaaaaaaaaa", status: "ended", scheduledStartTime: undefined });
  assert.equal(rows("push_notifications").length, 2, "a recording is not announced");
});

test("live session published while already live -> only 'live started' (no 'new live' on top)", async () => {
  const cookie = await adminCookie();
  await register(tok(1));
  await call("/api/admin/live-sessions", { method: "POST", cookie, body: { youtubeVideoId: "bbbbbbbbbbb", title: "Live now", status: "live", isPublished: true } });
  assert.deepEqual(rows("push_notifications").map((n) => n.kind), ["liveStart"]);
});

test("courses: becoming public notifies once with /courses/:slug; hidden / draft / edits do not", async () => {
  const cookie = await adminCookie();
  await register(tok(1));
  const create = (over) => call("/api/admin/courses", { method: "POST", cookie, body: { title: "Tajweed", price: 0, status: "enrollment_closed", isPublished: false, ...over } });
  const created = await json(await create({}));
  assert.equal(created.success, true, JSON.stringify(created));
  assert.equal(rows("push_notifications").length, 0, "hidden course: silent");
  const id = created.data.course.id;

  await call(`/api/admin/courses/${id}`, { method: "PATCH", cookie, body: { description: "x" } });
  assert.equal(rows("push_notifications").length, 0);
  await call(`/api/admin/courses/${id}`, { method: "PATCH", cookie, body: { isPublished: true } });
  assert.equal(rows("push_notifications").length, 1);
  assert.equal(rows("push_notifications")[0].link, `/courses/${created.data.course.slug}`);
  assert.equal(rows("push_notifications")[0].category, "courses");
  await call(`/api/admin/courses/${id}`, { method: "PATCH", cookie, body: { description: "y" } });
  await call(`/api/admin/courses/${id}`, { method: "PATCH", cookie, body: { isPublished: false } });
  await call(`/api/admin/courses/${id}`, { method: "PATCH", cookie, body: { isPublished: true } });
  assert.equal(rows("push_notifications").length, 1, "re-publishing the same course does not notify again");
});

test("cron sweep: a published session whose time has come is announced once; old ones and unpublished ones are not", async () => {
  const config = loadConfig(baseEnv());
  await register(tok(1));
  const now = Date.now();
  const add = (over) => rows("live_sessions").push({ _id: new ObjectId(), youtubeVideoId: "x", title: "S", status: "scheduled", isPublished: true, createdAt: new Date(), ...over });
  add({ title: "just started", scheduledStartTime: new Date(now - 5 * 60_000) });
  add({ title: "started hours ago", scheduledStartTime: new Date(now - 5 * 3600_000) });
  add({ title: "not yet", scheduledStartTime: new Date(now + 3600_000) });
  add({ title: "hidden", isPublished: false, scheduledStartTime: new Date(now - 60_000) });
  assert.equal((await E.sweepLiveStarts(config)).sent, 1);
  assert.equal((await E.sweepLiveStarts(config)).sent, 0, "second run: already announced");
  assert.equal(rows("push_notifications").length, 1);
  assert.equal(rows("push_notifications")[0].body, "just started");
  assert.equal((await E.sweepLiveStarts(loadConfig(baseEnv({ FIREBASE_SERVICE_ACCOUNT: undefined })))).sent, 0);
});

test("Android notification payload carries the deep link used by the app (data.link) and a per-notification tag", async () => {
  const cookie = await adminCookie();
  await register(tok(1), "android");
  const n = (await json(await call("/api/admin/notifications", { method: "POST", cookie, body: goodNote({ link: "https://site.example/courses/tajweed" }) }))).data.notification;
  assert.equal(n.link, "/courses/tajweed");
  const m = sent[0].message;
  assert.equal(m.data.link, "/courses/tajweed");
  assert.equal(m.android.notification.tag, n.id, "the same notification replaces itself instead of stacking");
});

test.after(() => { globalThis.fetch = realFetch; });
