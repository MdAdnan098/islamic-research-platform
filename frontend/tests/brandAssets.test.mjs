// The logo and favicon files that the page and the components point to must exist (a typo would silently show a broken image).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pub = (p) => new URL(`../public${p}`, import.meta.url);
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("index.html: every favicon / touch icon it links to exists in /public", () => {
  const hrefs = [...read("../index.html").matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 4, hrefs.join(","));
  for (const h of hrefs) assert.ok(existsSync(pub(h)), `${h} is missing`);
  assert.ok(hrefs.every((h) => h.startsWith("/brand/")));
});

test("Logo.jsx: shows ONE logo image - the whole picture, not cropped - and that file exists with the same proportions", () => {
  const src = read("../src/components/brand/Logo.jsx");
  const file = /const SRC = "([^"]+)"/.exec(src)[1];
  const ratio = eval(/const RATIO = ([\d.]+ \/ [\d.]+)/.exec(src)[1]); // eslint-disable-line no-eval
  assert.ok(existsSync(pub(file)), `${file} is missing`);
  const buf = readFileSync(pub(file));
  assert.equal(buf.slice(0, 4).toString(), "RIFF");
  assert.equal(buf.slice(8, 12).toString(), "WEBP");
  // the supplied picture is 1079 x 927; the file keeps its proportions (no crop)
  assert.ok(Math.abs(ratio - 1079 / 927) < 0.005, `ratio ${ratio}`);
});

test("sizes and texts are as before: navbar 32, footer 36, admin menu 26, sign-in pages 46; text next to the logo is shown", () => {
  assert.match(read("../src/components/public/Navbar.jsx"), /<Logo size=\{32\} badge \/>/);
  assert.match(read("../src/components/public/Footer.jsx"), /<Logo size=\{36\} badge \/>/);
  assert.match(read("../src/admin/AdminLayout.jsx"), /<LogoMark size=\{26\} badge \/>/);
  for (const f of ["../src/admin/pages/Login.jsx", "../src/admin/pages/AdminAccess.jsx"]) assert.match(read(f), /<LogoMark size=\{46\} \/>/);
  assert.match(read("../src/components/brand/Logo.jsx"), /showText = true/);
});

test("the old logo and favicon files are still there (going back is one git revert, nothing was deleted)", () => {
  for (const f of ["/logo.png", "/logo-dark.png", "/favicon.ico", "/favicon-32.png", "/favicon-192.png", "/apple-touch-icon.png"]) assert.ok(existsSync(pub(f)), f);
});
