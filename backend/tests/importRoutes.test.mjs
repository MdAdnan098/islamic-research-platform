// Run: cd backend && node --test tests/importRoutes.test.mjs
// Automatic Article Importer, P1: drives the real Worker entry point (src/index.js) for POST /api/admin/import/page
// and /image, with the same in-memory stand-in for MongoDB that adminSecurity.test.mjs uses. The "remote site" is a
// mocked global fetch, so there is no network, no database and no secret (all values are generated at runtime).
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";

const admins = [];
const adminsCollection = {
  async findOne(q) { return admins.find((d) => (q._id ? String(d._id) === String(q._id) : d.username === q.username)) || null; },
  async createIndex() {},
};
const fakeDb = { collection: () => adminsCollection, command: async () => ({ ok: 1 }) };
MongoClient.prototype.connect = async function connect() { return this; };
MongoClient.prototype.db = () => fakeDb;

const { default: worker } = await import("../src/index.js");
const { signJwt } = await import("../src/utils/jwt.js");

const rand = () => `${crypto.randomUUID()}${crypto.randomUUID()}`;
const JWT_SECRET = rand();
const ORIGIN = "https://site.example";
const env = { MONGODB_URI: "mongodb://localhost/unused", MONGODB_DB_NAME: "t", ADMIN_JWT_SECRET: JWT_SECRET, ENVIRONMENT: "production", ALLOWED_ORIGIN: ORIGIN };

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

let upstream; // calls made to the mocked "remote site"
let upstreamHandler;
const realFetch = globalThis.fetch;
beforeEach(() => {
  admins.length = 0;
  upstream = [];
  upstreamHandler = async () => new Response("<h1>Hi</h1>", { status: 200, headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "sid=remote-secret", "x-powered-by": "WordPress" } });
  globalThis.fetch = async (url, init) => { upstream.push({ url, init }); return upstreamHandler(url, init); };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function adminCookie() {
  const doc = { _id: new ObjectId(), username: "alice", role: "admin", active: true, createdAt: new Date() };
  admins.push(doc);
  const token = await signJwt({ sub: String(doc._id), username: "alice", role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 });
  return `admin_session=${token}`;
}
const call = (path, { body, cookie, method = "POST", headers = {} } = {}) =>
  worker.fetch(
    new Request(`https://api.example${path}`, {
      method,
      headers: { "CF-Connecting-IP": "203.0.113.9", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    { waitUntil() {} }
  );

test("both import routes require an admin session and never contact the remote site for anonymous callers", async () => {
  for (const path of ["/api/admin/import/page", "/api/admin/import/image"]) {
    const res = await call(path, { body: { url: "https://example.org/a" } });
    assert.equal(res.status, 401, path);
    assert.equal((await res.json()).error.code, "UNAUTHENTICATED");
  }
  const bad = await call("/api/admin/import/page", { body: { url: "https://example.org/a" }, cookie: "admin_session=garbage" });
  assert.equal(bad.status, 401);
  assert.equal(upstream.length, 0);
});

test("only POST is routed (a GET with a url in the query string is not a way in)", async () => {
  const cookie = await adminCookie();
  const res = await call("/api/admin/import/page?url=https://example.org/a", { method: "GET", cookie });
  assert.ok([404, 405].includes(res.status), String(res.status));
  assert.equal(upstream.length, 0);
});

test("page: returns the fetched page inside the normal JSON envelope and forwards nothing from the admin's request", async () => {
  const cookie = await adminCookie();
  const res = await call("/api/admin/import/page", { body: { url: "https://Example.org/post/#x" }, cookie, headers: { Authorization: "Bearer should-not-leave", "X-Forwarded-For": "1.2.3.4" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, data: { finalUrl: "https://example.org/post/", contentType: "text/html", body: "<h1>Hi</h1>" } });
  assert.equal(upstream.length, 1);
  const { url, init } = upstream[0];
  assert.equal(url, "https://example.org/post/");
  assert.deepEqual(Object.keys(init.headers).sort(), ["Accept", "User-Agent"]);
  assert.equal(init.redirect, "manual");
  // admin-route headers: never cached; exact-origin CORS with credentials; no upstream headers are copied over
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(res.headers.get("Set-Cookie"), null);
  assert.equal(res.headers.get("X-Powered-By"), null);
});

test("image: returns raw bytes with the sniffed type, no-store, a locked-down CSP and the exact CORS origin", async () => {
  const cookie = await adminCookie();
  upstreamHandler = async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png", "set-cookie": "sid=remote-secret" } });
  const res = await call("/api/admin/import/image", { body: { url: "https://cdn.example.org/a.png" }, cookie });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/png");
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [...PNG]);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(res.headers.get("Content-Security-Policy"), /sandbox/);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");
  assert.equal(res.headers.get("Set-Cookie"), null);
});

test("bad input is rejected with clean 4xx errors and the remote site is never contacted", async () => {
  const cookie = await adminCookie();
  const cases = [
    [{ url: "http://127.0.0.1/admin" }, 403, "IMPORT_BLOCKED_HOST"],
    [{ url: "https://169.254.169.254/latest/meta-data/" }, 403, "IMPORT_BLOCKED_HOST"],
    [{ url: "https://localhost/x" }, 403, "IMPORT_BLOCKED_HOST"],
    [{ url: "https://example.org:8080/" }, 403, "IMPORT_BLOCKED_HOST"],
    [{ url: "file:///etc/passwd" }, 400, "IMPORT_URL_INVALID"],
    [{ url: "https://user:pw@example.org/" }, 400, "IMPORT_URL_INVALID"],
    [{ url: 123 }, 400, "IMPORT_URL_INVALID"],
    [{}, 400, "IMPORT_URL_INVALID"],
    [[], 400, "IMPORT_URL_INVALID"],
    ["not json", 400, "IMPORT_URL_INVALID"],
    [JSON.stringify({ url: "https://example.org/", pad: "x".repeat(9000) }), 413, "IMPORT_TOO_LARGE"],
  ];
  for (const path of ["/api/admin/import/page", "/api/admin/import/image"]) {
    for (const [body, status, code] of cases) {
      const res = await call(path, { body, cookie });
      assert.equal(res.status, status, `${path} ${JSON.stringify(body).slice(0, 50)}`);
      assert.equal((await res.json()).error.code, code);
    }
  }
  assert.equal(upstream.length, 0);
});

test("caller-supplied limits, headers or methods in the body are ignored", async () => {
  const cookie = await adminCookie();
  const res = await call("/api/admin/import/page", { body: { url: "https://example.org/a", maxBytes: 999999999, timeoutMs: 999999, method: "POST", headers: { Cookie: "x=1" }, redirect: "follow", kind: "image" }, cookie });
  assert.equal(res.status, 200);
  const { init } = upstream[0];
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(Object.keys(init.headers).sort(), ["Accept", "User-Agent"]);
});

test("upstream failures reach the admin as fixed messages (502 / 504 / 413 / 415), never as remote content", async () => {
  const cookie = await adminCookie();
  const run = async (handler, path = "/api/admin/import/page") => {
    upstreamHandler = handler;
    const res = await call(path, { body: { url: "https://example.org/a" }, cookie });
    return { status: res.status, json: await res.json() };
  };
  let r = await run(async () => new Response("<pre>stack trace /srv/wp 10.0.0.4</pre>", { status: 500, headers: { "content-type": "text/html" } }));
  assert.equal(r.status, 502);
  assert.deepEqual(r.json.error, { message: "The site responded with HTTP 500.", code: "IMPORT_UPSTREAM_ERROR" });
  r = await run(async () => { throw new TypeError("connect ECONNREFUSED 10.0.0.4:443"); });
  assert.deepEqual([r.status, r.json.error.code, r.json.error.message], [502, "IMPORT_UPSTREAM_ERROR", "The site could not be reached."]);
  r = await run(async () => new Response("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } }));
  assert.deepEqual([r.status, r.json.error.code], [415, "IMPORT_UNSUPPORTED_TYPE"]);
  r = await run(async () => new Response("x", { status: 200, headers: { "content-type": "text/html", "content-length": String(6 * 1024 * 1024) } }));
  assert.deepEqual([r.status, r.json.error.code], [413, "IMPORT_TOO_LARGE"]);
  r = await run(async () => new Response("<html>", { status: 200, headers: { "content-type": "image/png" } }), "/api/admin/import/image");
  assert.deepEqual([r.status, r.json.error.code], [415, "IMPORT_UNSUPPORTED_TYPE"]);
});

test("the import routes are read-only: they never touch the database beyond the admin session lookup", async () => {
  const cookie = await adminCookie();
  const touched = new Set();
  const spyDb = { collection: (name) => { touched.add(name); return adminsCollection; }, command: async () => ({ ok: 1 }) };
  const original = MongoClient.prototype.db;
  MongoClient.prototype.db = () => spyDb;
  try {
    await call("/api/admin/import/page", { body: { url: "https://example.org/a" }, cookie });
    upstreamHandler = async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    await call("/api/admin/import/image", { body: { url: "https://example.org/a.png" }, cookie });
  } finally {
    MongoClient.prototype.db = original;
  }
  assert.deepEqual([...touched], ["admins"]);
});

test("an oversized body is refused even when it is streamed without a Content-Length (chunked upload)", async () => {
  const cookie = await adminCookie();
  const chunk = new TextEncoder().encode(`{"url":"https://example.org/","pad":"${"x".repeat(2000)}`);
  let sent = 0;
  const body = new ReadableStream({ pull(c) { if (sent++ < 20) c.enqueue(chunk); else c.close(); } });
  const res = await worker.fetch(
    new Request("https://api.example/api/admin/import/page", { method: "POST", body, duplex: "half", headers: { "Content-Type": "application/json", Cookie: cookie, "CF-Connecting-IP": "203.0.113.9" } }),
    env,
    { waitUntil() {} }
  );
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, "IMPORT_TOO_LARGE");
  assert.equal(upstream.length, 0);
});
