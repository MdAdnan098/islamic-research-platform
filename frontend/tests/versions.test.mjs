import test from "node:test";
import assert from "node:assert/strict";
import { buildCopyText, parsePaste, applyPaste, parseRefBlock, pickRef } from "../src/lib/versions.js";

const blocks = [
  { id: "a", type: "text", text: "Allah ne ilm hasil karne ka hukm diya hai." },
  { id: "b", type: "reference", referenceId: "r1" },
];
const refs = { r1: { id: "r1", book: "Sahih Bukhari", author: "Imam Bukhari", volume: "1", page: "45", referenceText: null } };

test("copy prompt names the target script and includes the reference block", () => {
  for (const lang of ["en", "hi", "ur"]) {
    const t = buildCopyText(lang, "Ilm ki ahmiyat", blocks, "en", refs);
    assert.ok(t.includes("TARGET SCRIPT"));
    assert.ok(t.includes("[0]\nIlm ki ahmiyat"));
    assert.ok(t.includes("[2]\nBook: Sahih Bukhari\nAuthor: Imam Bukhari\nVolume: 1\nPage: 45"));
  }
  assert.ok(buildCopyText("ur", "x", blocks, "en", refs).includes("Urdu script"));
});

test("reference answer is parsed even with markdown labels, and applied to the block only", () => {
  const f = parseRefBlock("**Book:** صحیح بخاری\nAuthor: امام بخاری\nVolume: 1\nPage: 45");
  assert.deepEqual(f, { book: "صحیح بخاری", author: "امام بخاری", volume: "1", page: "45" });
  const parsed = parsePaste("[1]\nاللہ نے علم\n\n[2]\nBook: صحیح بخاری\nAuthor: امام بخاری", 2);
  const r = applyPaste("ur", parsed, {}, blocks, "en");
  assert.equal(r.count, 2);
  assert.equal(r.blocks[1].tr.ur.book, "صحیح بخاری");
  assert.equal(pickRef(refs.r1, r.blocks[1].tr, "en", "ur").book, "صحیح بخاری");
  assert.equal(pickRef(refs.r1, r.blocks[1].tr, "en", "en").book, "Sahih Bukhari");
  assert.equal(pickRef(refs.r1, r.blocks[1].tr, "en", "hi").book, "Sahih Bukhari"); // not converted yet -> original
});
