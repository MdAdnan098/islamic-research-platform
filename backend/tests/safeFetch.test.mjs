// Run: cd backend && node --test tests/safeFetch.test.mjs
// Unit tests for utils/safeFetch.js (Automatic Article Importer, P1). Nothing here touches the network: every
// "remote site" is a mocked fetch. No database, no secrets.
import test from "node:test";
import assert from "node:assert/strict";
import { IMPORT_LIMITS, fetchImportImage, fetchImportPage, safeFetch, sniffImageType, validateImportUrl } from "../src/utils/safeFetch.js";
import { toPublicError } from "../src/middleware/errorHandler.js";

/* ------------------------------------------ helpers ------------------------------------------ */
const enc = new TextEncoder();
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const GIF = enc.encode("GIF89a\u0001\u0000\u0001\u0000");
const WEBP = Uint8Array.from([...enc.encode("RIFF"), 0, 0, 0, 0, ...enc.encode("WEBPVP8 ")]);
const AVIF = Uint8Array.from([0, 0, 0, 0x18, ...enc.encode("ftypavif"), 0, 0, 0, 0, ...enc.encode("mif1avif")]);

const page = (body, type = "text/html; charset=utf-8", extra = {}) => new Response(body, { status: 200, headers: { "content-type": type, ...extra } });
const image = (bytes, type) => new Response(bytes, { status: 200, headers: { "content-type": type } });
const redirect = (location, status = 302) => new Response(null, { status, headers: { location } });

/** fetch stand-in: hands out the queued responses in order and records every call. */
function mockFetch(...queue) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return typeof next === "function" ? next(url, init) : next;
  };
  fn.calls = calls;
  return fn;
}
const rejects = (promise, code, status) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
    if (status) assert.equal(e.status, status);
    return true;
  });
const blocked = (url) => assert.throws(() => validateImportUrl(url), (e) => /^IMPORT_/.test(e.code), `should be refused: ${JSON.stringify(url)}`);
const timeoutsNow = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

/* ----------------------------------------- URL rules ----------------------------------------- */
test("accepts ordinary public article URLs and returns the normalised, fragment-free URL that will be fetched", () => {
  for (const [input, href] of [
    ["https://example.org/2026/05/article-title/", "https://example.org/2026/05/article-title/"],
    ["  http://blog.example.com/?p=123  ", "http://blog.example.com/?p=123"],
    ["https://EXAMPLE.org/Post#comments", "https://example.org/Post"],
    ["https://sub.domain.co.uk:443/x", "https://sub.domain.co.uk/x"],
    ["http://news.example.com:80/y", "http://news.example.com/y"],
    ["https://example.org/%D8%A7%D8%B1%D8%AF%D9%88", "https://example.org/%D8%A7%D8%B1%D8%AF%D9%88"],
    ["https://xn--mgbaam7a8h.example.org/", "https://xn--mgbaam7a8h.example.org/"],
    ["https://مثال.example.org/", "https://xn--mgbh0fb.example.org/"],
  ]) {
    assert.equal(validateImportUrl(input).href, href, input);
  }
});

test("the host that is checked is the host that is fetched (no backslash / userinfo parser tricks)", () => {
  assert.equal(validateImportUrl("https://example.com\\@127.0.0.1/").hostname, "example.com");
  assert.throws(() => validateImportUrl("https://example.com@127.0.0.1/"), { code: "IMPORT_URL_INVALID" });
  assert.throws(() => validateImportUrl("https://127.0.0.1@example.com/"), { code: "IMPORT_URL_INVALID" });
});

test("refuses non-http schemes, malformed input and credentials", () => {
  for (const bad of [
    undefined, null, 42, {}, [], "", "   ", "not a url", "//example.com/x", "example.com/x",
    "ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,<b>x</b>", "gopher://example.com/", "ws://example.com/", "blob:https://example.com/1",
    "https://user:pw@example.com/", "https://user@example.com/", "https://:pw@example.com/",
    `https://example.com/${"a".repeat(IMPORT_LIMITS.maxUrlLength)}`,
  ]) blocked(bad);
});

test("refuses every IP-address host in every notation (IPv4 decimal / hex / octal / short, IPv6, mapped)", () => {
  for (const ip of [
    "127.0.0.1", "127.1", "2130706433", "0x7f000001", "0177.0.0.1", "0x7f.1", "0.0.0.0", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "224.0.0.1", "255.255.255.255", "8.8.8.8", "93.184.216.34",
    "[::1]", "[::]", "[::ffff:127.0.0.1]", "[::ffff:7f00:1]", "[fc00::1]", "[fd12:3456::1]", "[fe80::1]", "[2001:db8::1]", "[2606:4700:4700::1111]",
  ]) {
    blocked(`http://${ip}/`);
    blocked(`https://${ip}:443/x`);
  }
});

test("refuses internal-looking and single-label host names, odd ports and wildcard-IP DNS services", () => {
  for (const host of [
    "localhost", "LOCALHOST", "localhost.", "foo.localhost", "printer.local", "nas.lan", "router.home", "db.internal", "metadata.google.internal",
    "intranet", "wiki", "server.corp", "x.localdomain", "1.0.0.127.in-addr.arpa", "svc.test", "a.invalid", "b.example", "hidden.onion",
    "127.0.0.1.nip.io", "10.0.0.1.sslip.io", "app.localtest.me", "a.lvh.me", "b.vcap.me", "x.xip.io",
    "my_site.example.org", "-bad.example.org", "bad-.example.org", "a..example.org", "exa mple.org",
  ]) {
    blocked(`https://${host}/`);
  }
  for (const port of [22, 25, 81, 3306, 5432, 6379, 8080, 8443, 8787, 27017, 65535]) blocked(`https://example.org:${port}/`);
});

test("KNOWN LIMITATION: a public-looking name that resolves to a private address cannot be detected (no DNS in Workers)", () => {
  // Documented, not fixed: Workers expose no DNS API, so this can only be caught by network-level controls.
  assert.doesNotThrow(() => validateImportUrl("https://rebind.attacker-example.net/"));
});

/* ------------------------------------------ pages ------------------------------------------ */
test("fetches a page: GET, manual redirects, only the fixed headers, no cookies / credentials / caller headers", async () => {
  const f = mockFetch(page("<html><h1>Salaam</h1></html>"));
  const out = await fetchImportPage("https://EXAMPLE.org/post/#top", { fetch: f });
  assert.deepEqual(out, { finalUrl: "https://example.org/post/", contentType: "text/html", body: "<html><h1>Salaam</h1></html>" });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, "https://example.org/post/");
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(Object.keys(init.headers).sort(), ["Accept", "User-Agent"]);
  assert.ok(!("credentials" in init) && !("body" in init));
});

test("accepts html, xhtml and JSON pages (WordPress REST) and rejects other types, including a missing type", async () => {
  for (const type of ["text/html", "TEXT/HTML; charset=UTF-8", "application/xhtml+xml", "application/json; charset=UTF-8"]) {
    assert.equal((await fetchImportPage("https://example.org/a", { fetch: mockFetch(page("{}", type)) })).body, "{}", type);
  }
  for (const type of ["text/plain", "application/pdf", "image/png", "application/octet-stream", "text/xml", "application/javascript", "multipart/form-data", ""]) {
    await rejects(fetchImportPage("https://example.org/a", { fetch: mockFetch(page("x", type)) }), "IMPORT_UNSUPPORTED_TYPE", 415);
  }
  await rejects(fetchImportPage("https://example.org/a", { fetch: mockFetch(new Response("x", { status: 200 })) }), "IMPORT_UNSUPPORTED_TYPE");
});

test("decodes Urdu / Arabic pages by header charset, by <meta charset>, and defaults to UTF-8", async () => {
  const urdu = "اردو مضمون";
  assert.equal((await fetchImportPage("https://example.org/", { fetch: mockFetch(page(urdu)) })).body, urdu);
  assert.equal((await fetchImportPage("https://example.org/", { fetch: mockFetch(page(urdu, "text/html")) })).body, urdu);
  const win1256 = Uint8Array.from([0xc7, 0xd1, 0xcf, 0xe6]); // "اردو" in windows-1256
  assert.equal((await fetchImportPage("https://example.org/", { fetch: mockFetch(page(win1256, "text/html; charset=windows-1256")) })).body, "اردو");
  const withMeta = Uint8Array.from([...enc.encode('<meta charset="windows-1256">'), ...win1256]);
  assert.ok((await fetchImportPage("https://example.org/", { fetch: mockFetch(page(withMeta, "text/html")) })).body.endsWith("اردو"));
  assert.equal((await fetchImportPage("https://example.org/", { fetch: mockFetch(page("ok", "text/html; charset=not-a-charset")) })).body, "ok"); // unknown label -> UTF-8
});

test("HTTP errors and empty bodies become one fixed upstream error (the remote body is never reflected)", async () => {
  for (const status of [400, 403, 404, 410, 429, 500, 503]) {
    await assert.rejects(
      fetchImportPage("https://example.org/a", { fetch: mockFetch(new Response("<secret>internal stack trace 10.1.2.3</secret>", { status, headers: { "content-type": "text/html" } })) }),
      (e) => e.code === "IMPORT_UPSTREAM_ERROR" && e.status === 502 && e.message === `The site responded with HTTP ${status}.` && !/secret|10\.1\.2\.3/.test(e.message)
    );
  }
  await rejects(fetchImportPage("https://example.org/a", { fetch: mockFetch(page("")) }), "IMPORT_UPSTREAM_ERROR");
  await rejects(fetchImportPage("https://example.org/a", { fetch: mockFetch(new Response(null, { status: 304 })) }), "IMPORT_UPSTREAM_ERROR");
});

test("network failures give a generic message that does not leak the underlying error", async () => {
  const f = async () => { throw new TypeError("connect ECONNREFUSED 10.0.0.7:443 (internal-host.corp)"); };
  await assert.rejects(fetchImportPage("https://example.org/a", { fetch: f }), (e) => e.code === "IMPORT_UPSTREAM_ERROR" && e.message === "The site could not be reached.");
  const sync = () => { throw new Error("sync boom"); };
  await rejects(fetchImportPage("https://example.org/a", { fetch: sync }), "IMPORT_UPSTREAM_ERROR");
});

/* ----------------------------------------- redirects ----------------------------------------- */
test("follows redirects (absolute and relative), re-validating each hop, and reports the final URL", async () => {
  const f = mockFetch(redirect("https://www.example.org/post/", 301), redirect("/final/?x=1", 302), page("<p>done</p>"));
  const out = await fetchImportPage("https://example.org/post", { fetch: f });
  assert.equal(out.finalUrl, "https://www.example.org/final/?x=1");
  assert.deepEqual(f.calls.map((c) => c.url), ["https://example.org/post", "https://www.example.org/post/", "https://www.example.org/final/?x=1"]);
  for (const status of [301, 302, 303, 307, 308]) {
    assert.equal((await fetchImportPage("https://example.org/", { fetch: mockFetch(redirect("/b", status), page("ok")) })).body, "ok", String(status));
  }
});

test("a redirect to a blocked address / scheme / port / credentials is refused BEFORE it is requested", async () => {
  for (const target of [
    "http://127.0.0.1/admin", "https://169.254.169.254/latest/meta-data/", "http://[::1]/", "https://localhost/x", "https://db.internal/", "https://127.0.0.1.nip.io/",
    "ftp://example.org/x", "file:///etc/passwd", "javascript:alert(1)", "https://example.org:8080/x", "https://user:pw@example.org/",
  ]) {
    const f = mockFetch(redirect(target), page("must never be fetched"));
    await assert.rejects(fetchImportPage("https://example.org/start", { fetch: f }), (e) => /^IMPORT_(BLOCKED_HOST|URL_INVALID)$/.test(e.code), target);
    assert.equal(f.calls.length, 1, `${target} must not be requested`);
  }
});

test("refuses https -> http downgrades, allows http -> https, caps the redirect count, and rejects bad Location headers", async () => {
  const down = mockFetch(redirect("http://example.org/plain"), page("x"));
  await rejects(fetchImportPage("https://example.org/", { fetch: down }), "IMPORT_BLOCKED_HOST");
  assert.equal(down.calls.length, 1);
  assert.equal((await fetchImportPage("http://example.org/", { fetch: mockFetch(redirect("https://example.org/"), page("secure")) })).body, "secure");

  const three = mockFetch(redirect("/1"), redirect("/2"), redirect("/3"), page("ok after 3"));
  assert.equal((await fetchImportPage("https://example.org/", { fetch: three })).body, "ok after 3");
  const four = mockFetch(redirect("/1"), redirect("/2"), redirect("/3"), redirect("/4"), page("never"));
  await rejects(fetchImportPage("https://example.org/", { fetch: four }), "IMPORT_UPSTREAM_ERROR");
  assert.equal(four.calls.length, 4);
  const loop = async () => redirect("/same");
  await rejects(fetchImportPage("https://example.org/same", { fetch: loop }), "IMPORT_UPSTREAM_ERROR");

  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(new Response(null, { status: 302 })) }), "IMPORT_UPSTREAM_ERROR");
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(redirect("http://[bad")) }), "IMPORT_UPSTREAM_ERROR");
});

/* ------------------------------------------- size ------------------------------------------- */
test("a declared Content-Length above the cap is refused and the body is cancelled, not read", async () => {
  let cancelled = false;
  let reads = 0;
  const body = new ReadableStream({ pull(c) { reads += 1; c.enqueue(new Uint8Array(10)); }, cancel() { cancelled = true; } });
  const res = new Response(body, { status: 200, headers: { "content-type": "text/html", "content-length": "1000" } });
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(res), maxBytes: 999 }), "IMPORT_TOO_LARGE", 413);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(cancelled, "the upstream body must be cancelled");
  assert.ok(reads <= 1, "nothing beyond the stream's own prefetch may be read");
});

test("a missing or lying Content-Length cannot bypass the cap: the download is counted and stopped", async () => {
  let cancelled = false;
  const endless = () => new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(4096)); }, cancel() { cancelled = true; } }), { status: 200, headers: { "content-type": "text/html" } });
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(endless()), maxBytes: 50_000 }), "IMPORT_TOO_LARGE");
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(cancelled, "the upstream stream must be cancelled once the cap is exceeded");

  const lying = new Response(new Uint8Array(20_000), { status: 200, headers: { "content-type": "text/html", "content-length": "10" } });
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(lying), maxBytes: 10_000 }), "IMPORT_TOO_LARGE");
});

test("exactly the cap is accepted; one byte more is not", async () => {
  const ok = await fetchImportPage("https://example.org/", { fetch: mockFetch(page("a".repeat(1000))), maxBytes: 1000 });
  assert.equal(ok.body.length, 1000);
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(page("a".repeat(1001))), maxBytes: 1000 }), "IMPORT_TOO_LARGE");
});

test("default limits are the ones that were approved (5 MB pages, 20 MB images, 10 s / 15 s, 3 redirects)", () => {
  assert.equal(IMPORT_LIMITS.pageMaxBytes, 5 * 1024 * 1024);
  assert.equal(IMPORT_LIMITS.imageMaxBytes, 20 * 1024 * 1024);
  assert.equal(IMPORT_LIMITS.pageTimeoutMs, 10_000);
  assert.equal(IMPORT_LIMITS.imageTimeoutMs, 15_000);
  assert.equal(IMPORT_LIMITS.maxRedirects, 3);
  assert.ok(Object.isFrozen(IMPORT_LIMITS));
});

/* ------------------------------------------ timeouts ------------------------------------------ */
test("times out when the site never answers, even if the fetch ignores the abort signal", async () => {
  const before = timeoutsNow();
  const t0 = Date.now();
  await rejects(fetchImportPage("https://example.org/", { fetch: () => new Promise(() => {}), timeoutMs: 40 }), "IMPORT_TIMEOUT", 504);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(timeoutsNow(), before, "the deadline timer must be cleared");
});

test("times out when the headers arrive but the body stalls, and when the fetch honours the abort signal", async () => {
  const stalled = new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode("<html>")); }, pull: () => new Promise(() => {}) }), { status: 200, headers: { "content-type": "text/html" } });
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(stalled), timeoutMs: 40 }), "IMPORT_TIMEOUT");
  const honours = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  await rejects(fetchImportPage("https://example.org/", { fetch: honours, timeoutMs: 40 }), "IMPORT_TIMEOUT");
});

test("one deadline covers the whole redirect chain, not each hop", async () => {
  const slow = (res) => async () => { await new Promise((r) => setTimeout(r, 30)); return res(); };
  const f = mockFetch(slow(() => redirect("/2")), slow(() => redirect("/3")), slow(() => page("too late")));
  await rejects(fetchImportPage("https://example.org/1", { fetch: f, timeoutMs: 70 }), "IMPORT_TIMEOUT");
});

test("the deadline timer is cleared after success and after failure", async () => {
  const before = timeoutsNow();
  await fetchImportPage("https://example.org/", { fetch: mockFetch(page("ok")) });
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(new Response("x", { status: 404 })) }), "IMPORT_UPSTREAM_ERROR");
  await rejects(fetchImportPage("https://example.org/", { fetch: mockFetch(page("a".repeat(100))), maxBytes: 10 }), "IMPORT_TOO_LARGE");
  assert.equal(timeoutsNow(), before);
});

/* ------------------------------------------- images ------------------------------------------- */
test("sniffImageType recognises the allowed formats and rejects SVG, HTML, PDF, truncated and empty data", () => {
  assert.equal(sniffImageType(JPEG), "image/jpeg");
  assert.equal(sniffImageType(PNG), "image/png");
  assert.equal(sniffImageType(GIF), "image/gif");
  assert.equal(sniffImageType(WEBP), "image/webp");
  assert.equal(sniffImageType(AVIF), "image/avif");
  for (const bad of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "<!doctype html><html>", "%PDF-1.7", "GIF8", "", "RIFF\u0000\u0000\u0000\u0000WAVEfmt "]) assert.equal(sniffImageType(enc.encode(bad)), null, bad);
  assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8])), null);
  assert.equal(sniffImageType(null), null);
});

test("returns image bytes with the SNIFFED content type; accepts the common jpeg aliases", async () => {
  for (const [bytes, header, expected] of [[PNG, "image/png", "image/png"], [JPEG, "image/jpeg", "image/jpeg"], [JPEG, "image/jpg", "image/jpeg"], [JPEG, "IMAGE/PJPEG", "image/jpeg"], [GIF, "image/gif", "image/gif"], [WEBP, "image/webp", "image/webp"], [AVIF, "image/avif", "image/avif"]]) {
    const out = await fetchImportImage("https://cdn.example.org/a.img", { fetch: mockFetch(image(bytes, header)) });
    assert.equal(out.contentType, expected, header);
    assert.deepEqual([...out.bytes], [...bytes], header);
  }
});

test("rejects SVG, HTML disguised as an image, octet-stream, mismatched type/bytes, and tiny or empty files", async () => {
  const cases = [
    [enc.encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "image/svg+xml", "IMPORT_UNSUPPORTED_TYPE"],
    [enc.encode("<html><script>alert(1)</script></html>"), "image/png", "IMPORT_UNSUPPORTED_TYPE"],
    [PNG, "application/octet-stream", "IMPORT_UNSUPPORTED_TYPE"],
    [PNG, "text/html", "IMPORT_UNSUPPORTED_TYPE"],
    [PNG, "application/pdf", "IMPORT_UNSUPPORTED_TYPE"],
    [JPEG, "image/png", "IMPORT_UNSUPPORTED_TYPE"],
    [PNG, "image/jpeg", "IMPORT_UNSUPPORTED_TYPE"],
    [Uint8Array.from([0xff, 0xd8]), "image/jpeg", "IMPORT_UNSUPPORTED_TYPE"],
    [new Uint8Array(0), "image/png", "IMPORT_UPSTREAM_ERROR"],
  ];
  for (const [bytes, type, code] of cases) await rejects(fetchImportImage("https://cdn.example.org/x", { fetch: mockFetch(image(bytes, type)) }), code);
});

test("images obey the size cap and the image deadline", async () => {
  const big = new Uint8Array(5000);
  big.set(PNG);
  await rejects(fetchImportImage("https://cdn.example.org/x", { fetch: mockFetch(image(big, "image/png")), maxBytes: 4999 }), "IMPORT_TOO_LARGE");
  assert.equal((await fetchImportImage("https://cdn.example.org/x", { fetch: mockFetch(image(big, "image/png")), maxBytes: 5000 })).bytes.byteLength, 5000);
  await rejects(fetchImportImage("https://cdn.example.org/x", { fetch: () => new Promise(() => {}), timeoutMs: 30 }), "IMPORT_TIMEOUT");
});

test("an image redirect to a private address is refused, and the image Accept header does not ask for AVIF", async () => {
  const f = mockFetch(redirect("http://169.254.169.254/latest/meta-data/"), image(PNG, "image/png"));
  await rejects(fetchImportImage("https://cdn.example.org/x.png", { fetch: f }), "IMPORT_BLOCKED_HOST");
  assert.equal(f.calls.length, 1);
  assert.ok(!/avif/.test(f.calls[0].init.headers.Accept));
});

/* ----------------------------------------- misc / API ----------------------------------------- */
test("safeFetch needs an explicit kind, and the default fetch is the global one (called as a plain function)", async () => {
  await assert.rejects(safeFetch("https://example.org/", {}), /kind/);
  const realFetch = globalThis.fetch;
  let seenThis = "unset";
  globalThis.fetch = function (url) { seenThis = this; return Promise.resolve(page(`got ${url}`)); };
  try {
    assert.equal((await fetchImportPage("https://example.org/g")).body, "got https://example.org/g");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(seenThis === undefined || seenThis === globalThis);
});

test("import errors reach the client with their own status, code and fixed message (via the real error handler)", () => {
  const cases = [
    ["IMPORT_URL_INVALID", 400, "That is not a valid URL."],
    ["IMPORT_BLOCKED_HOST", 403, "That host name is not allowed."],
    ["IMPORT_TOO_LARGE", 413, "The file is too large to import."],
    ["IMPORT_UNSUPPORTED_TYPE", 415, "That URL does not return a supported page type."],
    ["IMPORT_UPSTREAM_ERROR", 502, "The site could not be reached."],
    ["IMPORT_TIMEOUT", 504, "The site took too long to respond."],
  ];
  for (const [code, status, message] of cases) {
    const err = Object.assign(new Error(message), { status, code });
    assert.deepEqual(toPublicError(err), { status, code, message }, code);
  }
  // 5xx codes that are NOT on the allow-list are still replaced by the generic message.
  assert.equal(toPublicError(Object.assign(new Error("secret detail"), { status: 502, code: "SOMETHING_ELSE" })).message, "Internal server error.");
});
