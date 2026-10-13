import test from "node:test";
import assert from "node:assert/strict";
import { buildCopyText, parsePaste, applyPaste, parseRefBlock, pickRef, parseByOrder } from "../src/lib/versions.js";

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

test("paste is order-independent and accepts Urdu / Hindi digits", () => {
  const p = parsePaste("[3]\nteesra\n\n[\u06F1]\npehla\n\n[\u0968]\nदूसरा", 3);
  assert.deepEqual(p, { 3: "teesra", 1: "pehla", 2: "दूसरा" });
  // a footnote-like "[1]" inside a paragraph does not cut the text of block 2
  const q = parsePaste("[1]\nek\n\n[2]\ndo [1] aur", 2);
  assert.equal(q[2], "do [1] aur");
});

test("without any markers the parts are taken in order when the counts match", () => {
  const bl = [{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }];
  assert.deepEqual(parseByOrder("T\n\nx\n\ny", bl, true), { 0: "T", 1: "x", 3: "y" });
  assert.equal(parseByOrder("x", bl, true), null);
});

// Regression: a reference block keeps its converted fields as an OBJECT in tr[lang]; the renderer asks shownLang()/pickVersion()
// about every block, and calling .trim() on that object crashed Urdu/Roman pages ("l.trim is not a function").
import { shownLang } from "../src/lib/highlights.js";
import { pickVersion } from "../src/lib/versions.js";
test("reference blocks with object translations do not crash shownLang / pickVersion", () => {
  const ref = { id: "r", type: "reference", referenceId: "x", tr: { ur: { book: "کتاب" }, en: { book: "Kitab" } } };
  assert.equal(shownLang(ref, "hi", "ur"), "hi");
  assert.equal(shownLang(ref, "hi", "en"), "hi");
  assert.equal(shownLang({ type: "text", text: "a", tr: { ur: "ب" } }, "hi", "ur"), "ur");
  assert.equal(pickVersion("base", { ur: { book: "x" } }, "hi", "ur"), "base");
  assert.equal(pickVersion("base", { ur: "ب" }, "hi", "ur"), "ب");
});
test("copy prompt asks the converter to fix obvious typing mistakes", () => {
  const out = buildCopyText("ur", "t", [{ type: "text", text: "अहले बैल" }], "hi", {});
  assert.match(out, /FIX THE AUTHOR'S TYPING MISTAKES/);
});
