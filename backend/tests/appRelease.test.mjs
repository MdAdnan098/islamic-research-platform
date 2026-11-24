// Run: cd backend && node --test tests/
// Phase 2 (Android app update system): version rules, URL validation, and the public / admin API end to end through the
// real Worker entry point, with an in-memory stand-in for MongoDB (no database, network or secret needed).
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";

/* ------------------------- in-memory collections ------------------------- */
const store = { admins: [], app_releases: [] };
let dbFailure = null; // set to an Error to simulate a driver failure
const matches = (doc, q) => Object.entries(q).every(([k, v]) => (k === "_id" ? String(doc._id) === String(v) : doc[k] === v));
const collection = (name) => ({
  async findOne(q) { if (dbFailure) throw dbFailure; return store[name].find((d) => matches(d, q)) || null; },
  async updateOne(q, update, opts = {}) {
    if (dbFailure) throw dbFailure;
    let d = store[name].find((x) => matches(x, q));
    if (!d && opts.upsert) { d = { ...q }; store[name].push(d); }
    if (d) Object.assign(d, update.$set);
    return { matchedCount: d ? 1 : 0 };
  },
  async createIndex() {},
});
MongoClient.prototype.connect = async function connect() { return this; };
MongoClient.prototype.db = () => ({ collection, command: async () => ({ ok: 1 }) });

const { default: worker } = await import("../src/index.js");
const { signJwt } = await import("../src/utils/jwt.js");
const { _resetAuthLimiterForTests } = await import("../src/middleware/rateLimit.js");
const { routes: adminAppRoutes } = await import("../src/routes/admin.appRelease.routes.js");
const R = await import("../src/utils/appRelease.js");

const JWT_SECRET = `${crypto.randomUUID()}${crypto.randomUUID()}`; // runtime-only, never written anywhere
const baseEnv = (extra = {}) => ({ MONGODB_URI: "mongodb://localhost/unused", MONGODB_DB_NAME: "t", ADMIN_JWT_SECRET: JWT_SECRET, ENVIRONMENT: "production", ALLOWED_ORIGIN: "https://site.example", ...extra });

let ip = 0;
const call = (path, { method = "GET", body, env = baseEnv(), cookie } = {}) =>
  worker.fetch(
    new Request(`https://api.example${path}`, {
      method,
      headers: { "CF-Connecting-IP": `203.0.113.${++ip % 250}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil() {} }
  );

async function adminCookie() {
  const _id = new ObjectId();
  store.admins.push({ _id, username: "tester", role: "admin", active: true, createdAt: new Date() });
  const token = await signJwt({ sub: String(_id), username: "tester", role: "admin" }, JWT_SECRET, { expiresInSeconds: 600 });
  return `admin_session=${token}`;
}

const goodRelease = (over = {}) => ({
  latestVersion: "1.2.0", minSupportedVersion: "1.0", releaseDate: "2026-11-22",
  releaseNotes: ["New update dialog", "Bug fixes"], downloadUrl: "https://downloads.example.com/athari-1.2.0.apk",
  storeUrl: "", mandatory: false, published: true, ...over,
});

beforeEach(() => { store.admins.length = 0; store.app_releases.length = 0; dbFailure = null; _resetAuthLimiterForTests(); });

/* ------------------------------ version rules ------------------------------ */
test("compareVersions: numeric, not alphabetical; 1.0 equals 1.0.0; invalid -> null", () => {
  assert.equal(R.compareVersions("1.10", "1.9"), 1);
  assert.equal(R.compareVersions("1.0", "1.0.0"), 0);
  assert.equal(R.compareVersions("2", "10"), -1);
  assert.equal(R.compareVersions("1.2.3.4", "1.2.3.5"), -1);
  for (const bad of ["", "abc", "1.", ".1", "1..2", "1.2.3.4.5", "v1.0", "1.0-beta", "-1", "12345", null, 1.5]) {
    assert.equal(R.isValidVersion(bad), false, String(bad));
    assert.equal(R.compareVersions(bad, "1.0"), null);
  }
});

test("validateDownloadUrl: https only, no credentials, no IP / localhost, optional host allow-list", () => {
  assert.equal(R.validateDownloadUrl("https://downloads.example.com/a.apk"), null);
  assert.equal(R.validateDownloadUrl(""), null); // empty = not set
  for (const bad of ["http://example.com/a.apk", "ftp://example.com/a.apk", "javascript:alert(1)", "https://user:pw@example.com/a.apk", "https://127.0.0.1/a.apk", "https://192.168.1.5/a.apk", "https://[::1]/a.apk", "https://localhost/a.apk", "https://intranet/a.apk", "not a url", `https://example.com/${"a".repeat(2100)}`]) {
    assert.ok(R.validateDownloadUrl(bad), bad.slice(0, 40));
  }
  const allowed = R.parseAllowedHosts(" github.com , Example.org ");
  assert.deepEqual(allowed, ["github.com", "example.org"]);
  assert.equal(R.validateDownloadUrl("https://github.com/x/y/releases/download/v1/a.apk", allowed), null);
  assert.equal(R.validateDownloadUrl("https://objects.github.com/a.apk", allowed), null); // subdomain
  assert.ok(R.validateDownloadUrl("https://evilgithub.com/a.apk", allowed)); // not a subdomain
  assert.ok(R.validateDownloadUrl("https://evil.com/a.apk", allowed));
});

test("validateReleaseInput: rules for versions, date, notes, URLs, publish", () => {
  assert.equal(R.validateReleaseInput(goodRelease()).errors.length, 0);
  const err = (over) => R.validateReleaseInput(goodRelease(over)).errors[0]?.code;
  assert.equal(err({ latestVersion: "abc" }), "INVALID_VERSION");
  assert.equal(err({ minSupportedVersion: "2.0" }), "INVALID_VERSION"); // min > latest
  assert.equal(err({ releaseDate: "22-11-2026" }), "INVALID_INPUT");
  assert.equal(err({ releaseDate: "2026-02-31" }), "INVALID_INPUT");
  assert.equal(err({ downloadUrl: "http://x.example.com/a.apk" }), "INVALID_URL");
  assert.equal(err({ downloadUrl: "", storeUrl: "" }), "URL_REQUIRED"); // cannot publish without somewhere to update from
  assert.equal(err({ downloadUrl: "", storeUrl: "", published: false }), undefined); // a draft may have no URL yet
  assert.equal(err({ mandatory: "yes" }), "INVALID_INPUT");
  const notes = R.validateReleaseInput(goodRelease({ releaseNotes: "  one \n\n two  " })).value.releaseNotes;
  assert.deepEqual(notes, ["one", "two"]);
  assert.ok(R.validateReleaseInput(goodRelease({ releaseNotes: Array(21).fill("x") })).errors.length);
  assert.equal(R.validateReleaseInput(null).errors.length, 1);
  assert.equal(R.validateReleaseInput(goodRelease({ minSupportedVersion: "" })).value.minSupportedVersion, null);
});

/* ------------------------------- public API ------------------------------- */
test("public: nothing configured -> { release: null }, no login needed, not cached", async () => {
  const res = await call("/api/public/app-update");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.release, null);
  assert.match(res.headers.get("Cache-Control") || "", /no-cache/);
});

test("public: an UNPUBLISHED release is invisible; a published one shows only public fields", async () => {
  const cookie = await adminCookie();
  let res = await call("/api/admin/app-release", { method: "PUT", cookie, body: goodRelease({ published: false }) });
  assert.equal(res.status, 200);
  assert.equal((await (await call("/api/public/app-update")).json()).data.release, null);

  res = await call("/api/admin/app-release", { method: "PUT", cookie, body: goodRelease({ mandatory: true }) });
  assert.equal(res.status, 200);
  const pub = (await (await call("/api/public/app-update")).json()).data.release;
  assert.equal(pub.latestVersion, "1.2.0");
  assert.equal(pub.mandatory, true);
  assert.deepEqual(pub.releaseNotes, ["New update dialog", "Bug fixes"]);
  assert.equal(pub.downloadUrl, "https://downloads.example.com/athari-1.2.0.apk");
  assert.equal("updatedBy" in pub || "updatedAt" in pub || "published" in pub, false); // nothing administrative leaks

  // unpublish again -> disappears at once
  await call("/api/admin/app-release", { method: "PUT", cookie, body: goodRelease({ published: false }) });
  assert.equal((await (await call("/api/public/app-update")).json()).data.release, null);
});

test("public: a database failure answers a generic 5xx (the app then simply skips the check)", async () => {
  dbFailure = new Error("mongodb://user:secret@cluster.example/ connection refused");
  const res = await call("/api/public/app-update");
  assert.ok(res.status >= 500);
  const text = await res.text();
  assert.doesNotMatch(text, /secret|cluster|mongodb/i);
});

/* ------------------------------- admin API ------------------------------- */
test("admin authorization: both routes need a valid admin session; the public route does not", async () => {
  for (const [method, path] of adminAppRoutes.map(([m, p]) => [m, p])) {
    const anon = await call(path, { method, body: method === "GET" ? undefined : goodRelease() });
    assert.equal(anon.status, 401, `${method} ${path} without a session`);
    const forged = await call(path, { method, cookie: "admin_session=aaa.bbb.ccc", body: method === "GET" ? undefined : goodRelease() });
    assert.equal(forged.status, 401, `${method} ${path} with a forged token`);
  }
  assert.equal(store.app_releases.length, 0, "nothing was written by anonymous calls");
  // a token for an admin that no longer exists / was deactivated is rejected too
  const cookie = await adminCookie();
  store.admins[0].active = false;
  assert.equal((await call("/api/admin/app-release", { cookie })).status, 401);
});

test("admin: save + read back; invalid input is rejected with 400 and writes nothing", async () => {
  const cookie = await adminCookie();
  let res = await call("/api/admin/app-release", { cookie });
  assert.equal((await res.json()).data.release, null);

  res = await call("/api/admin/app-release", { method: "PUT", cookie, body: goodRelease() });
  assert.equal(res.status, 200);
  const saved = (await res.json()).data.release;
  assert.equal(saved.updatedBy, "tester");
  assert.equal(saved.published, true);
  assert.match(res.headers.get("Cache-Control") || "", /no-store/);

  for (const bad of [{ latestVersion: "1.x" }, { downloadUrl: "http://insecure.example.com/a.apk" }, { minSupportedVersion: "9.9" }, { published: true, downloadUrl: "", storeUrl: "" }]) {
    const r = await call("/api/admin/app-release", { method: "PUT", cookie, body: goodRelease(bad) });
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal(store.app_releases.length, 1);
  assert.equal(store.app_releases[0].latestVersion, "1.2.0"); // unchanged by the rejected requests
  const notJson = await worker.fetch(new Request("https://api.example/api/admin/app-release", { method: "PUT", headers: { Cookie: cookie, "CF-Connecting-IP": "203.0.113.250" }, body: "{oops" }), baseEnv(), { waitUntil() {} });
  assert.equal(notJson.status, 400);
});

test("admin: APP_UPDATE_ALLOWED_HOSTS restricts where the APK may be hosted", async () => {
  const cookie = await adminCookie();
  const env = baseEnv({ APP_UPDATE_ALLOWED_HOSTS: "github.com" });
  const bad = await call("/api/admin/app-release", { method: "PUT", cookie, env, body: goodRelease({ downloadUrl: "https://evil.example.com/a.apk" }) });
  assert.equal(bad.status, 400);
  const ok = await call("/api/admin/app-release", { method: "PUT", cookie, env, body: goodRelease({ downloadUrl: "https://github.com/MdAdnan098/AthariTV-app/releases/download/v1.2.0/app.apk" }) });
  assert.equal(ok.status, 200);
  const get = await (await call("/api/admin/app-release", { cookie, env })).json();
  assert.deepEqual(get.data.allowedHosts, ["github.com"]);
});
