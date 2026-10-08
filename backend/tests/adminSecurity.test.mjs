// Run: cd backend && node --test tests/
// Admin security tests. They drive the real Worker entry point (src/index.js) end to end, but with an
// in-memory stand-in for MongoDB (the MongoClient methods are patched), so no database, network or
// secret is needed. All secrets below are generated at runtime and never written anywhere.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";

/* ------------------------- in-memory `admins` collection ------------------------- */
const admins = [];
const matches = (doc, q) => {
  if (q.$or) return q.$or.some((sub) => matches(doc, sub));
  return Object.entries(q).every(([k, v]) => (k === "_id" ? String(doc._id) === String(v) : doc[k] === v));
};
let dbFailure = null; // set to an Error to simulate a driver failure on the next findOne calls
const adminsCollection = {
  async findOne(q) { if (dbFailure) throw dbFailure; return admins.find((d) => matches(d, q)) || null; },
  async insertOne(doc) {
    if (doc.username && admins.some((d) => d.username === doc.username)) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    doc._id = new ObjectId();
    admins.push(doc);
    return { insertedId: doc._id };
  },
  async updateOne(q, update) { const d = admins.find((x) => matches(x, q)); if (d) Object.assign(d, update.$set); return { matchedCount: d ? 1 : 0 }; },
  async createIndex() {},
  async dropIndex() { throw new Error("index not found"); },
};
const fakeDb = { collection: () => adminsCollection, command: async () => ({ ok: 1 }) };
MongoClient.prototype.connect = async function connect() { return this; };
MongoClient.prototype.db = () => fakeDb;

const { default: worker } = await import("../src/index.js");
const { hashPassword, verifyPassword, secretsEqual, DUMMY_PASSWORD_HASH } = await import("../src/utils/password.js");
const { signJwt, verifyJwt } = await import("../src/utils/jwt.js");
const { _resetAuthLimiterForTests } = await import("../src/middleware/rateLimit.js");
const { toPublicError } = await import("../src/middleware/errorHandler.js");
const { routes: categoryRoutes } = await import("../src/routes/admin.categories.routes.js");
const { routes: topicRoutes } = await import("../src/routes/admin.topics.routes.js");
const { routes: articleRoutes } = await import("../src/routes/admin.articles.routes.js");
const { routes: referenceRoutes } = await import("../src/routes/admin.references.routes.js");
const { routes: liveRoutes } = await import("../src/routes/admin.live.routes.js");
const { routes: courseRoutes } = await import("../src/routes/admin.courses.routes.js");
const { routes: enrollmentRoutes } = await import("../src/routes/admin.enrollments.routes.js");
const { routes: mediaRoutes } = await import("../src/routes/media.routes.js");

/* ------------------------------------ helpers ------------------------------------ */
const rand = () => `${crypto.randomUUID()}${crypto.randomUUID()}`; // 72 chars, runtime-only
const JWT_SECRET = rand();
const REGISTER_KEY = rand();
const GOOD_PASSWORD = `${rand().slice(0, 16)}-Aa1`;
const ORIGIN = "https://site.example";
const baseEnv = () => ({ MONGODB_URI: "mongodb://localhost/unused", MONGODB_DB_NAME: "t", ADMIN_JWT_SECRET: JWT_SECRET, ADMIN_REGISTER_KEY: REGISTER_KEY, ENVIRONMENT: "production", ALLOWED_ORIGIN: ORIGIN });

let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;
const call = (path, { method = "GET", body, env = baseEnv(), cookie, ip = nextIp(), headers = {} } = {}) =>
  worker.fetch(
    new Request(`https://api.example${path}`, {
      method,
      headers: { "CF-Connecting-IP": ip, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
    env,
    { waitUntil() {} }
  );
const json = async (res) => res.json();
const sessionCookie = (res) => (res.headers.get("Set-Cookie") || "").split(";")[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedAdmin(username, password, extra = {}) {
  const doc = { username, passwordHash: await hashPassword(password), role: "admin", active: true, createdAt: new Date(), ...extra };
  await adminsCollection.insertOne(doc);
  return doc;
}
async function login(username, password, opts = {}) {
  return call("/api/admin/login", { method: "POST", body: { username, password }, ...opts });
}

beforeEach(() => { admins.length = 0; dbFailure = null; _resetAuthLimiterForTests(); });

/* ----------------------------------- login ----------------------------------- */
test("login works, sets a hardened cookie and never returns secrets", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  const res = await login("alice", GOOD_PASSWORD);
  assert.equal(res.status, 200);
  const cookie = res.headers.get("Set-Cookie");
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=7200"]) assert.ok(cookie.includes(attr), `cookie missing ${attr}`);
  const text = JSON.stringify(await json(res));
  assert.ok(!text.includes("passwordHash") && !text.includes("pbkdf2"));
  // The session cookie works on a protected route.
  const ping = await call("/api/admin/ping", { cookie: sessionCookie(res) });
  assert.equal(ping.status, 200);
});

test("invalid credentials fail with the same generic answer for unknown user, wrong password and inactive user", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  await seedAdmin("gone", GOOD_PASSWORD, { active: false });
  const answers = [];
  for (const [u, p] of [["alice", "wrong-password-123"], ["nobody", GOOD_PASSWORD], ["gone", GOOD_PASSWORD]]) {
    const res = await login(u, p);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("Set-Cookie"), null);
    answers.push(JSON.stringify(await json(res)));
  }
  assert.equal(new Set(answers).size, 1, "responses must be identical");
});

test("login input is validated (types, lengths, malformed JSON, oversized body)", async () => {
  for (const body of [{}, { username: "a" }, { username: ["alice"], password: "x" }, { username: { $ne: "" }, password: "x" }, { username: "alice", password: "x".repeat(257) }, { username: "a".repeat(300), password: "x" }, "not json", "[]"]) {
    const res = await login(body.username ?? "x", "x", {}).then(() => call("/api/admin/login", { method: "POST", body }));
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
  }
  const big = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ username: "a", password: "x".repeat(20000) }) });
  assert.equal(big.status, 413);
});

test("login brute force is throttled (429 + Retry-After), per IP, and expires on its own", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  const ip = nextIp();
  for (let i = 0; i < 8; i++) assert.equal((await login("alice", `bad-password-${i}`, { ip })).status, 401);
  const locked = await login("alice", GOOD_PASSWORD, { ip }); // even the right password is refused while locked
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("Retry-After")) > 0 && Number(locked.headers.get("Retry-After")) <= 900);
  // A different source address is not affected.
  assert.equal((await login("alice", GOOD_PASSWORD, { ip: nextIp() })).status, 200);
});

test("a successful login clears the failure counter, so a real admin is never worn down", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  const ip = nextIp();
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 7; i++) assert.equal((await login("alice", "nope-nope-nope", { ip })).status, 401);
    assert.equal((await login("alice", GOOD_PASSWORD, { ip })).status, 200);
  }
});

/* ------------------------- authorization / token handling ------------------------- */
test("EVERY /api/admin route (other than login/logout/register/reset) rejects unauthenticated requests", async () => {
  const id = new ObjectId().toString();
  const all = [...categoryRoutes, ...topicRoutes, ...articleRoutes, ...referenceRoutes, ...liveRoutes, ...courseRoutes, ...enrollmentRoutes, ...mediaRoutes, ["GET", "/api/admin/me"], ["GET", "/api/admin/ping"]]
    .filter(([, pattern]) => pattern.startsWith("/api/admin/"));
  assert.ok(all.length > 40, `expected the full admin surface, got ${all.length}`);
  for (const [method, pattern] of all) {
    const res = await call(pattern.replace(":id", id), { method, body: ["GET", "DELETE"].includes(method) ? undefined : {} });
    assert.equal(res.status, 401, `${method} ${pattern} must require auth`);
    assert.equal((await json(res)).error.code, "UNAUTHENTICATED");
  }
});

test("forged, tampered, expired and malformed tokens are rejected with 401 (never 500)", async () => {
  const admin = await seedAdmin("alice", GOOD_PASSWORD);
  const sub = String(admin._id);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const good = await signJwt({ sub, username: "alice", role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 });
  const [h, p, s] = good.split(".");
  const now = Math.floor(Date.now() / 1000);
  const forgedWithOtherSecret = await signJwt({ sub, role: "admin" }, rand(), { expiresInSeconds: 600 });
  const expired = await signJwt({ sub, role: "admin" }, JWT_SECRET, { expiresInSeconds: -10 });
  const noExp = `${h}.${b64({ sub, iat: now })}.${s}`;
  const cases = {
    valid: [good, 200],
    "alg none": [`${b64({ alg: "none", typ: "JWT" })}.${p}.`, 401],
    "alg none with sig": [`${b64({ alg: "none", typ: "JWT" })}.${p}.${s}`, 401],
    "other secret": [forgedWithOtherSecret, 401],
    "payload swapped": [`${h}.${b64({ sub, role: "superadmin", iat: now, exp: now + 999 })}.${s}`, 401],
    expired: [expired, 401],
    "missing exp": [noExp, 401],
    garbage: ["garbage", 401],
    "bad base64": [`${h}.@@@.${s}`, 401],
    "empty parts": ["..", 401],
    huge: ["a.".repeat(5000) + "a", 401],
    "unknown admin": [await signJwt({ sub: new ObjectId().toString(), role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 }), 401],
    "non-objectid sub": [await signJwt({ sub: "not-an-id", role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 }), 401],
  };
  for (const [name, [token, expected]] of Object.entries(cases)) {
    const res = await call("/api/admin/ping", { cookie: `admin_session=${token}` });
    assert.equal(res.status, expected, name);
  }
  // Malformed percent-escape in the cookie header used to throw inside decodeURIComponent.
  assert.equal((await call("/api/admin/ping", { cookie: "admin_session=%E0%A4%A" })).status, 401);
});

test("deactivating an admin cuts off their existing session immediately", async () => {
  const admin = await seedAdmin("alice", GOOD_PASSWORD);
  const cookie = sessionCookie(await login("alice", GOOD_PASSWORD));
  assert.equal((await call("/api/admin/ping", { cookie })).status, 200);
  admin.active = false;
  assert.equal((await call("/api/admin/ping", { cookie })).status, 401);
  assert.equal((await call("/api/admin/categories", { cookie })).status, 401);
});

/* ------------------------------ register / reset ------------------------------ */
test("register and reset require the secret key; wrong or missing key is a generic 403", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  for (const body of [{}, { secretKey: "wrong-key" }, { secretKey: 12345 }, { secretKey: REGISTER_KEY.slice(0, -1) }, { secretKey: REGISTER_KEY + "x" }]) {
    const reg = await call("/api/admin/register", { method: "POST", body: { ...body, username: "mallory", password: GOOD_PASSWORD } });
    assert.equal(reg.status, 403);
    const rst = await call("/api/admin/reset-password", { method: "POST", body: { ...body, username: "alice", newPassword: GOOD_PASSWORD } });
    assert.equal(rst.status, 403);
    assert.equal((await json(rst)).error.code, "INVALID_SECRET_KEY");
  }
  assert.equal(admins.length, 1, "no admin may be created without the key");
  assert.equal(await verifyPassword(GOOD_PASSWORD, admins[0].passwordHash), true, "password must be untouched");
});

test("guessing the secret key is throttled", async () => {
  const ip = nextIp();
  for (let i = 0; i < 5; i++) assert.equal((await call("/api/admin/register", { method: "POST", ip, body: { secretKey: `guess-${i}` } })).status, 403);
  const blocked = await call("/api/admin/register", { method: "POST", ip, body: { secretKey: REGISTER_KEY, username: "bob", password: GOOD_PASSWORD } });
  assert.equal(blocked.status, 429);
  assert.equal(admins.length, 0);
  // Reset shares the same budget.
  assert.equal((await call("/api/admin/reset-password", { method: "POST", ip, body: { secretKey: REGISTER_KEY, username: "x", newPassword: GOOD_PASSWORD } })).status, 429);
});

test("register works with the key; enforces username + password rules; never echoes the key", async () => {
  const ok = await call("/api/admin/register", { method: "POST", body: { secretKey: REGISTER_KEY, username: "Bob.Admin", password: GOOD_PASSWORD } });
  assert.equal(ok.status, 201);
  const text = JSON.stringify(await json(ok));
  assert.ok(!text.includes(REGISTER_KEY) && !text.includes(GOOD_PASSWORD));
  assert.equal(admins[0].username, "bob.admin");
  assert.equal((await login("bob.admin", GOOD_PASSWORD)).status, 200);

  const bad = async (over) => (await call("/api/admin/register", { method: "POST", body: { secretKey: REGISTER_KEY, username: "carol", password: GOOD_PASSWORD, ...over } })).status;
  assert.equal(await bad({ password: "short-pw-1" }), 400); // < 12
  assert.equal(await bad({ password: "aaaaaaaaaaaaaaaa" }), 400); // one repeated char
  assert.equal(await bad({ password: "my-carol-password-1" }), 400); // contains username
  assert.equal(await bad({ password: "x".repeat(257) }), 400);
  assert.equal(await bad({ username: "ab" }), 400);
  assert.equal(await bad({ username: "bad name!" }), 400);
  assert.equal(await bad({ username: "bob.admin" }), 409); // taken
  assert.equal(admins.length, 1);
});

test("registration can be closed with ADMIN_REGISTRATION_DISABLED, and is closed when no key is configured", async () => {
  const off = await call("/api/admin/register", { method: "POST", env: { ...baseEnv(), ADMIN_REGISTRATION_DISABLED: "true" }, body: { secretKey: REGISTER_KEY, username: "dave", password: GOOD_PASSWORD } });
  assert.equal(off.status, 403);
  const { ADMIN_REGISTER_KEY, ...noKeyEnv } = baseEnv();
  const noKey = await call("/api/admin/register", { method: "POST", env: noKeyEnv, body: { secretKey: "anything", username: "dave", password: GOOD_PASSWORD } });
  assert.equal(noKey.status, 500);
  assert.equal(admins.length, 0);
  assert.ok(!JSON.stringify(await json(noKey)).includes("ADMIN_REGISTER_KEY"));
});

test("password reset works and signs out every older session", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  const oldCookie = sessionCookie(await login("alice", GOOD_PASSWORD));
  assert.equal((await call("/api/admin/ping", { cookie: oldCookie })).status, 200);

  const newPassword = `${rand().slice(0, 16)}-Zz9`;
  const weak = await call("/api/admin/reset-password", { method: "POST", body: { secretKey: REGISTER_KEY, username: "alice", newPassword: "short" } });
  assert.equal(weak.status, 400);
  const missing = await call("/api/admin/reset-password", { method: "POST", body: { secretKey: REGISTER_KEY, username: "ghost", newPassword } });
  assert.equal(missing.status, 404);
  const reset = await call("/api/admin/reset-password", { method: "POST", body: { secretKey: REGISTER_KEY, username: "alice", newPassword } });
  assert.equal(reset.status, 200);

  assert.equal((await call("/api/admin/ping", { cookie: oldCookie })).status, 401, "old session must be revoked");
  assert.equal((await login("alice", GOOD_PASSWORD)).status, 401, "old password must stop working");
  await sleep(1100); // tokens carry whole-second timestamps; a login in the same second as the reset counts as older
  const fresh = await login("alice", newPassword);
  assert.equal(fresh.status, 200);
  assert.equal((await call("/api/admin/ping", { cookie: sessionCookie(fresh) })).status, 200);
});

/* --------------------------- public API, CORS, headers --------------------------- */
test("public endpoints and health still work; unknown or malformed paths give clean JSON 404s", async () => {
  assert.equal((await call("/api/public/ping")).status, 200);
  const health = await call("/health");
  assert.equal(health.status, 200);
  assert.equal((await json(health)).data.database, "connected");
  assert.equal((await call("/api/nope")).status, 404);
  const malformed = await call("/api/public/media/%E0%A4%A");
  assert.equal(malformed.status, 404);
  assert.equal((await json(malformed)).error.code, "NOT_FOUND");
});

test("responses carry security headers; admin responses are never cached", async () => {
  const res = await call("/api/public/ping");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.match(res.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.ok(res.headers.get("Strict-Transport-Security"));
  const admin = await call("/api/admin/ping");
  assert.equal(admin.headers.get("Cache-Control"), "no-store");
});

test("CORS: exact origin with credentials in production, never a wildcard", async () => {
  const res = await call("/api/public/ping");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");

  const pre = await call("/api/admin/login", { method: "OPTIONS" });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);

  for (const allowed of [undefined, "", "*"]) {
    const env = { ...baseEnv(), ALLOWED_ORIGIN: allowed };
    if (allowed === undefined) delete env.ALLOWED_ORIGIN;
    for (const r of [await call("/api/public/ping", { env }), await call("/api/admin/login", { method: "OPTIONS", env }), await call("/api/admin/ping", { env })]) {
      assert.equal(r.headers.get("Access-Control-Allow-Origin"), null, `production must not emit CORS for ALLOWED_ORIGIN=${JSON.stringify(allowed)}`);
      assert.equal(r.headers.get("Access-Control-Allow-Credentials"), null);
    }
  }
  // Local development keeps working with an explicit origin, and with the old fallback outside production.
  const dev = await call("/api/public/ping", { env: { ...baseEnv(), ENVIRONMENT: "development", ALLOWED_ORIGIN: "http://localhost:5173" } });
  assert.equal(dev.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  const devNoOrigin = await call("/api/public/ping", { env: { ...baseEnv(), ENVIRONMENT: "development", ALLOWED_ORIGIN: "" } });
  assert.equal(devNoOrigin.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(devNoOrigin.headers.get("Access-Control-Allow-Credentials"), null);
});

/* --------------------------------- error hygiene --------------------------------- */
test("unexpected and 5xx errors never leak internals; deliberate 4xx and payment messages are kept", () => {
  const mongoish = Object.assign(new Error("connection <monitor> to 10.1.2.3:27017 timed out (cluster0-shard-00-00.abcde.mongodb.net)"), { code: 11000 });
  assert.deepEqual(toPublicError(mongoish), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." });
  assert.deepEqual(toPublicError(new TypeError("Cannot read properties of undefined (reading 'x') at /src/secret/path.js:1")), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." });
  assert.equal(toPublicError(new Error("Missing required environment variable(s): MONGODB_URI")).message, "Server configuration error.");

  const db = Object.assign(new Error("Failed to connect to MongoDB: getaddrinfo ENOTFOUND cluster0.example.mongodb.net"), { status: 503, code: "DB_CONNECTION_ERROR" });
  const dbOut = toPublicError(db);
  assert.equal(dbOut.status, 503);
  assert.ok(!/mongodb|ENOTFOUND|cluster/i.test(dbOut.message));

  const storage = Object.assign(new Error("R2 bucket binding (MEDIA_BUCKET) is not configured."), { status: 500, code: "STORAGE_NOT_CONFIGURED" });
  assert.ok(!/MEDIA_BUCKET|R2/.test(toPublicError(storage).message));

  const gateway = Object.assign(new Error("The payment gateway returned an unexpected response."), { status: 502, code: "PAYMENT_GATEWAY_ERROR" });
  assert.equal(toPublicError(gateway).message, "The payment gateway returned an unexpected response.");
  const bad = Object.assign(new Error("Title is required."), { status: 400, code: "INVALID_INPUT" });
  assert.deepEqual(toPublicError(bad), { status: 400, code: "INVALID_INPUT", message: "Title is required." });
});

test("a database/driver failure inside a real request is reported generically (no hostnames, codes or messages)", async () => {
  await seedAdmin("alice", GOOD_PASSWORD);
  dbFailure = Object.assign(new Error("connection <monitor> to cluster0-shard-00-00.abcde.mongodb.net:27017 timed out"), { code: 11000 });
  const viaLogin = await login("alice", GOOD_PASSWORD);
  assert.equal(viaLogin.status, 500);
  const body = await json(viaLogin);
  assert.deepEqual(body, { success: false, error: { message: "Internal server error.", code: "INTERNAL_ERROR" } });
  assert.ok(!JSON.stringify(body).includes("mongodb"));
  // Same for an admin route that has to look the admin up.
  const token = await signJwt({ sub: String(admins[0]._id), role: "admin" }, JWT_SECRET, { expiresInSeconds: 60 });
  const viaAdmin = await call("/api/admin/categories", { cookie: `admin_session=${token}` });
  assert.equal(viaAdmin.status, 500);
  assert.ok(!JSON.stringify(await json(viaAdmin)).includes("mongodb"));
});

/* ------------------------------- crypto primitives ------------------------------- */
test("secretsEqual compares secrets of any length in a type-safe way", async () => {
  assert.equal(await secretsEqual("abc", "abc"), true);
  assert.equal(await secretsEqual("abc", "abd"), false);
  assert.equal(await secretsEqual("abc", "abcd"), false);
  assert.equal(await secretsEqual("", "abc"), false);
  assert.equal(await secretsEqual(undefined, "abc"), false);
  assert.equal(await secretsEqual(["abc"], "abc"), false);
});

test("the dummy hash is well formed, so unknown users cost the same PBKDF2 work as real ones", async () => {
  const parts = DUMMY_PASSWORD_HASH.split("$");
  assert.equal(parts.length, 4);
  assert.equal(Buffer.from(parts[2], "base64").length, 16);
  assert.equal(Buffer.from(parts[3], "base64").length, 32);
  const real = await hashPassword("whatever-123456");
  assert.equal(real.split("$")[1], parts[1], "same iteration count as real hashes");
  assert.equal(await verifyPassword("whatever-123456", DUMMY_PASSWORD_HASH), false);
});

test("jwt round trip keeps claims; wrong secret fails", async () => {
  const token = await signJwt({ sub: "abc", role: "admin" }, JWT_SECRET, { expiresInSeconds: 60 });
  const payload = await verifyJwt(token, JWT_SECRET);
  assert.equal(payload.sub, "abc");
  await assert.rejects(() => verifyJwt(token, rand()), (e) => e.status === 401);
});
