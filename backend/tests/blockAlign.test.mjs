// Run: cd backend && node --test tests/blockAlign.test.mjs   (needs no database and no npm packages)
import assert from "node:assert/strict";
import test from "node:test";
import { hasWrittenText, resolveSourceLanguage, validateBlockAlign } from "../src/utils/blockAlign.js";

const good = { v: 1, level: "sentence", len: { en: 30, hi: 28 }, units: [{ id: "u1", en: [0, 14], hi: [0, 12] }, { id: "u2", en: [15, 30], hi: [13, 28] }] };

test("align: a well-formed mapping (also a flagged, empty one) is accepted", () => {
  assert.equal(validateBlockAlign({ type: "text", text: "x" }), null);
  assert.equal(validateBlockAlign({ type: "text", align: good }), null);
  assert.equal(validateBlockAlign({ type: "heading", align: { v: 1, review: true, units: [] } }), null);
  assert.equal(validateBlockAlign({ type: "quote", kind: "quote", align: good }), null);
});

test("align: malformed mappings are rejected", () => {
  const bad = (align, block = {}) => validateBlockAlign({ type: "text", ...block, align });
  assert.ok(bad({ ...good, v: 2 }));
  assert.ok(bad("x"));
  assert.ok(bad([]));
  assert.ok(bad({ ...good, units: "nope" }));
  assert.ok(bad({ ...good, units: [{ id: "u1" }, { id: "u1" }] }), "duplicate ids");
  assert.ok(bad({ ...good, units: [{ id: "has space" }] }));
  assert.ok(bad({ ...good, units: [{ id: "u1", xx: [0, 1] }] }), "unknown language key");
  assert.ok(bad({ ...good, units: [{ id: "u1", en: [5, 5] }] }), "empty range");
  assert.ok(bad({ ...good, units: [{ id: "u1", en: [-1, 5] }] }));
  assert.ok(bad({ ...good, units: [{ id: "u1", en: [0.5, 5] }] }));
  assert.ok(bad({ ...good, units: Array.from({ length: 501 }, (_, i) => ({ id: `u${i}` })) }));
  assert.ok(bad({ ...good, len: { zz: 1 } }));
  assert.ok(bad({ ...good, review: "yes" }));
  assert.ok(validateBlockAlign({ type: "image", align: good }), "only text-like blocks");
  assert.ok(validateBlockAlign({ type: "quote", kind: "ayat", align: good }), "sacred blocks");
});

test("source language is permanent: a language re-detected from the text is ignored", () => {
  const existing = { language: "ur", sourceLanguage: "ur", blocks: [{ type: "text", text: "اردو متن" }] };
  assert.deepEqual(resolveSourceLanguage(existing, { language: "en" }), {});
  assert.deepEqual(resolveSourceLanguage(existing, { sourceLanguage: "hi", language: "hi" }), {});
  assert.deepEqual(resolveSourceLanguage(existing, {}), {});
});

test("source language: an older post adopts its stored language once; an already-wrong re-detection is repaired from sourceLanguage", () => {
  const older = { language: "hi", blocks: [{ type: "text", text: "नमस्ते" }] };
  assert.deepEqual(resolveSourceLanguage(older, { language: "en" }), { sourceLanguage: "hi" });
  assert.deepEqual(resolveSourceLanguage({ language: "en", sourceLanguage: "ur", blocks: [] }, {}), { language: "ur" });
});

test("source language can still be chosen while the post has no text yet", () => {
  assert.equal(hasWrittenText([{ type: "text", text: "  " }, { type: "image" }]), false);
  assert.equal(hasWrittenText([{ type: "heading", text: "x" }]), true);
  const empty = { language: "en", blocks: [{ type: "text", text: "" }] };
  assert.deepEqual(resolveSourceLanguage(empty, { language: "ur" }), { language: "ur", sourceLanguage: "ur" });
  assert.deepEqual(resolveSourceLanguage(empty, { sourceLanguage: "hi", language: "hi" }), { language: "hi", sourceLanguage: "hi" });
  assert.deepEqual(resolveSourceLanguage(empty, {}), {}); // nothing sent, nothing changed
});
