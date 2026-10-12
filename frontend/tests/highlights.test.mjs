// Run: cd frontend && node --test tests/*.test.mjs
import * as h from "../src/lib/highlights.js";
import assert from "node:assert/strict";
import test from "node:test";
test("highlight range maths, edit remapping and cleanup", () => {
assert.deepEqual(h.addRange([[0,3],[10,12]],[2,6]), [[0,6],[10,12]]);
assert.deepEqual(h.removeRange([[0,10]],[3,5]), [[0,3],[5,10]]);
assert.deepEqual(h.removeRange([[2,6]],[0,20]), []);
assert.deepEqual(h.sliceRanges([[2,8],[20,30]],5,25), [[0,3],[15,20]]);
assert.deepEqual(h.splitByRanges("abcdef",[[1,3]]), [{text:"a",marked:false},{text:"bc",marked:true},{text:"def",marked:false}]);
assert.deepEqual(h.trimRange("  hi  ",0,6), [2,4]);
assert.equal(h.trimRange("   ",0,3), null);
// remap: insert before -> shift; edit inside -> grow; delete the marked word -> gone
assert.deepEqual(h.remapRanges("hello wasila world","hello dear wasila world",[[6,12]]), [[11,17]]);
assert.deepEqual(h.remapRanges("hello wasila world","hello wasXila world",[[6,12]]), [[6,13]]);
assert.deepEqual(h.remapRanges("hello wasila world","hello  world",[[6,12]]), []);
assert.deepEqual(h.remapRanges("abc","abcd",[[0,3]]), [[0,3]]);
// paragraphs
assert.deepEqual(h.splitParagraphs("one\n\ntwo\n\n\nthree"), [{text:"one",start:0},{text:"two",start:5},{text:"three",start:11}]);
// edits
const b=[{id:"x",type:"text",text:"hello world"}];
const e=h.applyEdits(b,[{blockId:"x",lang:"en",ranges:[[0,5]]}]);
assert.deepEqual(e[0].hl,{en:[[0,5]]});
assert.equal("hl" in h.applyEdits(e,[{blockId:"x",lang:"en",ranges:[]}])[0], false);
// clean drops stale marks
assert.equal("hl" in h.cleanBlocksHl([{id:"y",type:"text",text:"ab",hl:{ur:[[0,1]]}}],"en")[0], false);
assert.deepEqual(h.cleanBlocksHl([{id:"y",type:"text",text:"abcd",hl:{en:[[1,99]]}}],"en")[0].hl,{en:[[1,4]]});
// withTextEdit
const w=h.withTextEdit({id:"z",type:"text",text:"hello wasila",hl:{en:[[6,12]]}},"en","oh hello wasila");
assert.deepEqual(w.hl,{en:[[9,15]]});


});

test("same-line sync across scripts", () => {
  assert.deepEqual(h.splitUnits("Pehli baat. Doosri baat?\nTeesri"), [[0,11],[12,24],[25,31]]);
  const b = { id: "x", type: "text", text: "Pehli baat. Doosri baat.", tr: { ur: "پہلی بات۔ دوسری بات۔", hi: "पहली बात। दूसरी बात।" } };
  const sp = h.syncSpans(b, "en", "ur", [0, 3]);
  assert.deepEqual(sp.map((x) => x.lang).sort(), ["en", "hi", "ur"]);
  assert.deepEqual(sp.find((x) => x.lang === "en").range, [0, 11]);
  // different line counts -> no sync
  assert.equal(h.syncSpans({ ...b, tr: { ur: "ایک۔" } }, "en", "en", [0, 3]), null);
  assert.deepEqual(h.alignmentIssues([{ ...b, tr: { ur: "ایک۔" } }], "en"), [1]);
  // pasted translation inherits marks
  const marked = { ...b, tr: { ur: b.tr.ur }, hl: { en: [[0, 11]] } };
  assert.deepEqual(h.inheritMarks(marked, "en", "ur").hl.ur, [[0, 9]]);
});

test("sync falls back to lines when sentence counts differ", () => {
  // Roman has no full stops, Hindi converter added them: sentence counts differ (1 vs 2) but lines match.
  const b = { id: "x", type: "text", text: "Pehli line\nDoosri line", tr: { hi: "पहली लाइन। दूसरी\nलाइन।\nतीसरी" } };
  assert.equal(h.unitMap(b, "en").aligned, false);
  const c = { id: "x", type: "text", text: "Pehli line\nDoosri line", tr: { hi: "पहली लाइन। दूसरी\nलाइन" } };
  const m = h.unitMap(c, "en");
  assert.equal(m.aligned, true);
  assert.equal(m.level, "line");
  const sp = h.syncSpans(c, "en", "en", [0, 4]);
  assert.deepEqual(sp.find((x) => x.lang === "hi").range, [0, 16]);
});
