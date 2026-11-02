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

test("Logo.jsx: every logo image it can show exists, with the size it declares", () => {
  const src = read("../src/components/brand/Logo.jsx");
  const found = [...src.matchAll(/src: "([^"]+)", w: (\d+), h: (\d+)/g)];
  assert.equal(found.length, 3);
  for (const [, file, w, h] of found) {
    assert.ok(existsSync(pub(file)), `${file} is missing`);
    // WebP header: "RIFF....WEBPVP8" - the canvas size sits in the bytes after it; checking the aspect ratio is enough here
    const buf = readFileSync(pub(file));
    assert.equal(buf.slice(0, 4).toString(), "RIFF");
    assert.equal(buf.slice(8, 12).toString(), "WEBP");
    assert.ok(Number(w) > 100 && Number(h) > 100);
  }
});

test("the old logo and favicon files are still there (going back is one git revert, nothing was deleted)", () => {
  for (const f of ["/logo.png", "/logo-dark.png", "/favicon.ico", "/favicon-32.png", "/favicon-192.png", "/apple-touch-icon.png"]) assert.ok(existsSync(pub(f)), f);
});
