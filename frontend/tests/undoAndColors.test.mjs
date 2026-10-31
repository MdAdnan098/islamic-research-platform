import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as h from "../src/lib/highlights.js";
import { inverseEdits, planEdits } from "../src/lib/formatPlan.js";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const rule = (sel) => { const m = new RegExp(sel.replace(/[.]/g, "\\.") + "\\s*\\{([^}]*)\\}").exec(css); assert.ok(m, sel + " not found"); return m[1]; };

test("highlight text colour: yellow and green have black text in light and dark mode", () => {
  assert.match(rule(".hl-mark"), /background: #fde047; color: #000;/);
  assert.match(rule(".hl-mark.hl-green"), /color: #000;/);
  assert.match(rule(".dark .hl-mark.hl-yellow"), /color: #0b0b0b;/);
  assert.match(rule(".dark .hl-mark.hl-green"), /color: #0b0b0b;/);
  assert.doesNotMatch(css, /\.hl-mark[^{]*\{[^}]*color: #(b91c1c|8a1c1c|fff|f1f1ec)/); // no red / white text left on highlights
});

const V = { en: "Allah ek hai. Ilm hasil karna farz hai.", hi: "अल्लाह एक है। इल्म हासिल करना फ़र्ज़ है।", ur: "اللہ ایک ہے۔ علم حاصل کرنا فرض ہے۔" };
const block = () => ({ id: "b1", type: "text", text: V.en, tr: { hi: V.hi, ur: V.ur } }); // legacy block: no stored mapping yet
const pieceOf = (b, i) => { const [s, e] = h.splitUnits(b.text)[i]; return { blockId: "b1", lang: "en", start: s, end: e }; };

test("undo restores the exact previous blocks (formatting and the first-time mapping); redo applies it again", () => {
  const before = [block()];
  const edits = planEdits({ blocks: before, baseLang: "en", pieces: [pieceOf(before[0], 1)], mode: "add", field: "hlGreen" }).edits;
  assert.ok(edits.some((e) => e.align), "the legacy block gets its mapping stored");
  const undo = inverseEdits(before, edits);
  const after = h.applyEdits(before, edits);
  assert.ok(after[0].hlGreen && after[0].align);
  assert.deepEqual(h.applyEdits(after, undo), before); // identical to the start: no hlGreen, no align
  assert.deepEqual(h.applyEdits(h.applyEdits(after, undo), edits), after); // redo
});

test("undo of a second action keeps the first one, and removing a colour is undone too", () => {
  let b = [block()];
  const e1 = planEdits({ blocks: b, baseLang: "en", pieces: [pieceOf(b[0], 0)], mode: "add", field: "hl" }).edits;
  const u1 = inverseEdits(b, e1); b = h.applyEdits(b, e1);
  const afterFirst = b;
  const e2 = planEdits({ blocks: b, baseLang: "en", pieces: [pieceOf(b[0], 1)], mode: "add", field: "bold" }).edits;
  const u2 = inverseEdits(b, e2); b = h.applyEdits(b, e2);
  assert.deepEqual(h.applyEdits(b, u2), afterFirst);
  const e3 = planEdits({ blocks: afterFirst, baseLang: "en", pieces: [pieceOf(afterFirst[0], 0)], mode: "remove", field: null }).edits;
  const removed = h.applyEdits(afterFirst, e3);
  assert.equal("hl" in removed[0], false);
  assert.deepEqual(h.applyEdits(removed, inverseEdits(afterFirst, e3)), afterFirst);
  assert.deepEqual(h.applyEdits(afterFirst, u1), [block()]); // undoing the first action brings back the untouched block
});
