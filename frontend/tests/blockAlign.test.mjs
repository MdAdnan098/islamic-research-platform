// Run: cd frontend && node --test tests/*.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import * as h from "../src/lib/highlights.js";
import { alignStatus, attachVersion, buildAlign, ensureAlign, pairUnits } from "../src/lib/blockAlign.js";
import { planEdits } from "../src/lib/formatPlan.js";
import { setLineHeading } from "../src/lib/lineHeading.js";
import { applyPaste } from "../src/lib/versions.js";
import { withIds } from "../src/lib/blocks.js";

// The same three sentences in three scripts - on purpose with DIFFERENT word counts and lengths per sentence.
const V = {
  en: "Allah ek hai. Ilm hasil karna har musalman par farz hai. Namaz qayam karo.",
  hi: "अल्लाह एक है। इल्म हासिल करना फ़र्ज़ है। नमाज़ क़ायम करो।",
  ur: "اللہ ایک ہے۔ ہر مسلمان پر علم حاصل کرنا فرض ہے۔ نماز قائم کرو۔",
};
const LANGS = ["en", "hi", "ur"];
const mk = (base, extra = {}) => ({ id: "b1", type: "text", text: V[base], tr: Object.fromEntries(LANGS.filter((l) => l !== base).map((l) => [l, V[l]])), ...extra });
const unitOf = (lang, i) => h.splitUnits(V[lang])[i];
const bySrc = (blocks, base, edits, id = "b1") => h.applyEdits(blocks, edits).find((b) => b.id === id);
const sel = (b, base, lang, i) => { const [s, e] = h.splitUnits(lang === base ? b.text : b.tr[lang])[i]; return { blockId: b.id, lang, start: s, end: e }; };
const plan = (blocks, base, pieces, mode, field) => planEdits({ blocks, baseLang: base, pieces, mode, field });

test("sentences really differ in word count across the scripts (premise of the tests)", () => {
  const words = (s) => s.split(/\s+/).length;
  const second = LANGS.map((l) => words(h.splitUnits(V[l])[1].reduce((a, z) => V[l].slice(a, z))));
  assert.ok(new Set(second).size > 1, `word counts ${second}`);
});

test("block ids: stable unit ids are created once and never regenerated", () => {
  const b = mk("en");
  const once = ensureAlign(b, "en");
  assert.equal(once.align.units.length, 3);
  assert.equal(once.align.review, undefined);
  const ids = once.align.units.map((u) => u.id);
  assert.equal(new Set(ids).size, 3);
  const twice = ensureAlign(once, "en");
  assert.equal(twice, once); // untouched when it already has a mapping
  assert.deepEqual(withIds([once])[0].align.units.map((u) => u.id), ids); // saving / reopening keeps them
  assert.deepEqual(JSON.parse(JSON.stringify(once)).align.units.map((u) => u.id), ids);
  assert.deepEqual(h.cleanBlocksHl([once], "en")[0].align.units.map((u) => u.id), ids);
  assert.equal(once.id, "b1");
});

test("a block whose versions have the same lines is 'mapped', one with different counts is 'review' - nothing is guessed", () => {
  assert.equal(alignStatus(mk("en"), "en"), "mapped");
  const bad = mk("en"); bad.tr.hi = V.hi + " एक और जुमला।";
  assert.equal(alignStatus(bad, "en"), "review");
  const al = buildAlign(bad, "en");
  assert.equal(al.review, true);
  assert.deepEqual(al.units, []);
  assert.equal(alignStatus({ id: "x", type: "text", text: V.en }, "en"), "single");
});

for (const base of LANGS) {
  const targets = LANGS.filter((l) => l !== base);
  test(`source ${base} -> ${targets.join(" + ")}: formatting on the source reaches the matching sentence of the others only`, () => {
    const blocks = [ensureAlign(mk(base), base)];
    const ids = blocks[0].align.units.map((u) => u.id);
    for (const [mode, field] of [["add", "hlPink"], ["add", "bold"], ["add", "tcRed"], ["size", 125]]) {
      const piece = sel(blocks[0], base, base, 1);
      const r = plan(blocks, base, [piece], mode, field);
      const layer = mode === "size" ? "sz125" : field;
      const next = bySrc(blocks, base, r.edits);
      for (const l of LANGS) {
        const expected = [h.splitUnits(l === base ? next.text : next.tr[l])[1]]; // the SAME (2nd) sentence of that script, whatever its length
        assert.deepEqual(next[layer]?.[l], expected, `${layer} on ${l} (source ${base})`);
        assert.equal(next[layer][l].length, 1);
      }
      // and it is the matching sentence's text, not just an index
      assert.equal(next.tr[targets[0]].slice(...next[layer][targets[0]][0]), h.splitUnits(V[targets[0]]).map(([a, z]) => V[targets[0]].slice(a, z))[1]);
    }
    assert.deepEqual(blocks[0].align.units.map((u) => u.id), ids);
  });
  test(`direct formatting on a translated version (${targets.join(", ")}) never changes the other two`, () => {
    const blocks = [ensureAlign(mk(base), base)];
    for (const from of targets) {
      for (const [mode, field] of [["add", "hl"], ["add", "bold"], ["add", "tcBlue"], ["size", 150], ["add", "arRed"]]) {
        const r = plan(blocks, base, [sel(blocks[0], base, from, 0)], mode, field);
        assert.ok(r.edits.length > 0);
        assert.ok(r.edits.every((e) => e.lang === from), `${mode} ${field} from ${from} touched ${r.edits.map((e) => e.lang)}`);
        assert.ok(r.notes.some((n) => n.code === "translated"));
      }
    }
  });
}

test("removing formatting on the source removes it from the matching sentence of the others", () => {
  let blocks = [ensureAlign(mk("ur"), "ur")];
  blocks = h.applyEdits(blocks, plan(blocks, "ur", [sel(blocks[0], "ur", "ur", 2)], "add", "hlGreen").edits);
  assert.ok(blocks[0].hlGreen.en && blocks[0].hlGreen.hi && blocks[0].hlGreen.ur);
  blocks = h.applyEdits(blocks, plan(blocks, "ur", [sel(blocks[0], "ur", "ur", 2)], "remove", null).edits);
  assert.equal("hlGreen" in blocks[0], false);
});

test("a few words (partial selection) stay in the source script; the toolbar is told why", () => {
  const blocks = [ensureAlign(mk("en"), "en")];
  const [s] = unitOf("en", 1);
  const r = plan(blocks, "en", [{ blockId: "b1", lang: "en", start: s, end: s + 4 }], "add", "bold");
  assert.deepEqual(r.edits.map((e) => e.lang), ["en"]);
  assert.deepEqual(r.notes, [{ code: "partial", count: 1 }]);
});

test("mapping survives edits: an added sentence in Hindi shifts positions, formatting still lands on the right sentence", () => {
  let b = ensureAlign(mk("en"), "en");
  // the admin adds a brand-new first sentence to the Hindi version (counts now 4 vs 3: the old count-based sync would be off by one)
  const hiNew = "नई बात। " + b.tr.hi;
  b = h.remapAlignLang({ ...b, tr: { ...b.tr, hi: hiNew } }, "hi", b.tr.hi, hiNew);
  assert.equal(alignStatus(b, "en"), "mapped");
  const r = plan([b], "en", [sel(b, "en", "en", 1)], "add", "hlBlue");
  const next = bySrc([b], "en", r.edits);
  const hiRange = next.hlBlue.hi[0];
  assert.equal(next.tr.hi.slice(...hiRange), "इल्म हासिल करना फ़र्ज़ है।"); // not the 2nd sentence of the Hindi text
});

test("editing the source text keeps ids and positions; editing without re-mapping is detected as stale (never trusted)", () => {
  let b = ensureAlign(mk("hi"), "hi");
  const ids = b.align.units.map((u) => u.id);
  const edited = h.withTextEdit(b, "hi", "भूमिका। " + b.text);
  assert.deepEqual(edited.align.units.map((u) => u.id), ids);
  assert.equal(alignStatus(edited, "hi"), "mapped");
  const sneaky = { ...b, text: "x" + b.text }; // text changed behind the mapping's back
  assert.equal(alignStatus(sneaky, "hi"), "review");
  assert.equal(h.unitMap(sneaky, "hi").stale, true);
  const r = plan([sneaky], "hi", [sel(sneaky, "hi", "hi", 1)], "add", "bold");
  assert.deepEqual(r.edits.map((e) => e.lang), ["hi"]);
  assert.equal(r.notes[0].code, "review");
});

test("deleting a whole sentence in one script flags the block instead of guessing", () => {
  const b = ensureAlign(mk("en"), "en");
  const gone = h.splitUnits(b.tr.ur);
  const newUr = b.tr.ur.slice(0, gone[1][0]) + b.tr.ur.slice(gone[1][1] + 1);
  const next = h.remapAlignLang({ ...b, tr: { ...b.tr, ur: newUr } }, "ur", b.tr.ur, newUr);
  assert.equal(next.align.review, true);
  assert.equal(alignStatus(next, "en"), "review");
});

test("manual pairing: lines with different counts can be tied together explicitly and then sync", () => {
  const b = mk("en"); b.tr.hi = "भूमिका। " + V.hi; // 4 Hindi sentences, 3 Roman ones
  assert.equal(alignStatus(b, "en"), "review");
  const res = pairUnits(b, "en", "sentence", { hi: [1, 2, 3], ur: [0, 1, 2] });
  assert.ok(res.align && !res.align.review);
  const paired = { ...b, align: res.align };
  assert.equal(alignStatus(paired, "en"), "mapped");
  const r = plan([paired], "en", [sel(paired, "en", "en", 0)], "add", "hlPink");
  const next = bySrc([paired], "en", r.edits);
  assert.equal(next.tr.hi.slice(...next.hlPink.hi[0]), "अल्लाह एक है।");
  assert.equal(pairUnits(b, "en", "sentence", { hi: [2, 1, 3], ur: [0, 1, 2] }).error !== undefined, true); // out of order is refused
  assert.equal(pairUnits(b, "en", "sentence", { hi: [1, 1, 3], ur: [0, 1, 2] }).error !== undefined, true); // reused unit is refused
  // an unpaired source line leaves the block flagged
  assert.equal(pairUnits(b, "en", "sentence", { hi: [1, null, 3], ur: [0, 1, 2] }).align.review, true);
});

test("paste: unit ids are kept when the next translation is pasted; a translation that does not fit is flagged, not forced", () => {
  const blocks = [{ id: "b1", type: "text", text: V.en }];
  const afterHi = applyPaste("hi", { 1: V.hi }, {}, blocks, "en").blocks;
  assert.equal(alignStatus(afterHi[0], "en"), "mapped");
  const ids = afterHi[0].align.units.map((u) => u.id);
  const afterUr = applyPaste("ur", { 1: V.ur }, {}, afterHi, "en").blocks;
  assert.deepEqual(afterUr[0].align.units.map((u) => u.id), ids);
  assert.ok(afterUr[0].align.units.every((u) => u.en && u.hi && u.ur));
  const odd = applyPaste("ur", { 1: V.ur + " ایک اور جملہ۔" }, {}, afterHi, "en").blocks[0];
  assert.equal(odd.align.review, true);
  assert.deepEqual(odd.align.units.map((u) => u.id), ids);
  assert.equal(alignStatus(odd, "en"), "review");
});

test("blocks are addressed by id: reorder, insert and delete never apply formatting to the wrong block", () => {
  const a = ensureAlign({ ...mk("en"), id: "a" }, "en"), c = ensureAlign({ ...mk("en"), id: "c", text: V.en }, "en");
  const mid = { id: "m", type: "heading", level: 2, text: "Tauheed", tr: { hi: "तौहीद", ur: "توحید" } };
  let blocks = [a, mid, c];
  const edits = plan(blocks, "en", [sel(c, "en", "en", 0)], "add", "hl").edits;
  for (const arrangement of [[c, a, mid], [mid, c], [{ id: "new", type: "divider" }, a, mid, c]]) {
    const out = h.applyEdits(arrangement, edits);
    assert.ok(out.find((b) => b.id === "c").hl);
    assert.ok(out.filter((b) => b.id !== "c").every((b) => !b.hl), "other blocks untouched");
  }
  // the heading block (single sentence, different lengths per script) syncs as a whole
  const hd = plan([mid], "en", [{ blockId: "m", lang: "en", start: 0, end: 7 }], "add", "bold");
  assert.deepEqual(hd.edits.filter((e) => e.lang).map((e) => e.lang).sort(), ["en", "hi", "ur"]);
  assert.equal(hd.edits.filter((e) => e.align).length, 1); // the legacy heading got its mapping stored once
});

test("Arabic quotation inside a Roman line: red follows the same Arabic words from the source, never from a translation", () => {
  const ar = "قُلْ هُوَ اللَّهُ أَحَدٌ";
  const b = { id: "q", type: "text", text: `Surah Ikhlas: ${ar}. Phir tarjuma.`, tr: { hi: `सूरह इख़लास: ${ar}। फिर तर्जुमा।`, ur: `سورہ اخلاص: ${ar}۔ پھر ترجمہ۔` } };
  const s = b.text.indexOf(ar);
  const fromSrc = plan([b], "en", [{ blockId: "q", lang: "en", start: s, end: s + ar.length }], "add", "arRed");
  assert.deepEqual(fromSrc.edits.map((e) => e.lang).sort(), ["en", "hi", "ur"]);
  const sh = b.tr.hi.indexOf(ar);
  const fromHi = plan([b], "en", [{ blockId: "q", lang: "hi", start: sh, end: sh + ar.length }], "add", "arRed");
  assert.deepEqual(fromHi.edits.map((e) => e.lang), ["hi"]);
});

test("sacred (ayat / hadith) blocks never get a mapping", () => {
  const sacred = { id: "s", type: "quote", kind: "ayat", text: "قُلْ هُوَ اللَّهُ أَحَدٌ", tr: { en: "Say: He is Allah, One." } };
  assert.equal(buildAlign(sacred, "ur"), null);
  assert.equal(alignStatus(sacred, "ur"), "none");
});

test("published post: source formatting -> draft save -> reopen keeps the synchronisation (all three sources)", () => {
  for (const base of LANGS) {
    // what the server stores and sends back (JSON), the way adminDraft.change() does it: plan -> applyEdits -> cleanBlocksHl -> save
    let stored = JSON.parse(JSON.stringify([ensureAlign(mk(base), base)]));
    const r = plan(stored, base, [sel(stored[0], base, base, 2)], "add", "hlGreen");
    stored = JSON.parse(JSON.stringify(h.cleanBlocksHl(h.applyEdits(stored, r.edits), base)));
    const reopened = stored[0];
    assert.ok(LANGS.every((l) => reopened.hlGreen[l]), `${base}: marks on every script`);
    assert.equal(alignStatus(reopened, base), "mapped");
    // a second change after reopening: bold only on the source's first sentence
    const r2 = plan(stored, base, [sel(reopened, base, base, 0)], "add", "bold");
    const again = h.applyEdits(stored, r2.edits)[0];
    assert.deepEqual(again.hlGreen, reopened.hlGreen); // earlier formatting untouched
    assert.ok(LANGS.every((l) => again.bold[l].length === 1));
    // the independent text of the other scripts is never overwritten
    for (const l of LANGS.filter((x) => x !== base)) assert.equal(again.tr[l], V[l]);
    assert.equal(again.text, V[base]);
  }
});

test("no loops / duplicates: planning twice gives the same result and applying the same plan twice changes nothing more", () => {
  const blocks = [ensureAlign(mk("en"), "en")];
  const r1 = plan(blocks, "en", [sel(blocks[0], "en", "en", 1)], "add", "tcGold");
  const once = h.applyEdits(blocks, r1.edits);
  const twice = h.applyEdits(once, r1.edits);
  assert.deepEqual(twice, once);
  assert.equal(plan(once, "en", [sel(once[0], "en", "en", 1)], "add", "tcGold").edits.length, 0); // nothing left to do
});

test("legacy block (no stored mapping): the first source formatting stores its mapping; reading alone writes nothing", () => {
  const legacy = mk("en");
  assert.equal("align" in legacy, false);
  assert.equal(alignStatus(legacy, "en"), "mapped"); // read-only proposal
  assert.equal("align" in legacy, false);
  const r = plan([legacy], "en", [sel(legacy, "en", "en", 1)], "add", "bold");
  assert.ok(r.edits.some((e) => e.align));
  const next = h.applyEdits([legacy], r.edits)[0];
  assert.equal(next.align.v, 1);
  assert.equal(next.align.units.length, 3);
});

test("headings: only the selected sentence becomes H3/H2 in every script; marks and mapping are re-based", () => {
  for (const base of LANGS) {
    const b = ensureAlign(mk(base), base);
    const marked = h.applyEdits([b], plan([b], base, [sel(b, base, base, 2)], "add", "bold").edits)[0];
    const res = setLineHeading([marked], base, [sel(marked, base, base, 1)], 3);
    assert.equal(res.error, "");
    assert.deepEqual(res.blocks.map((x) => x.type), ["text", "heading", "text"]);
    assert.equal(res.blocks[1].level, 3);
    assert.equal(res.blocks[0].id, "b1");
    for (const l of LANGS) {
      const t = (blk) => (l === base ? blk.text : blk.tr[l]);
      assert.equal(t(res.blocks[0]), h.splitUnits(V[l])[0].reduce((a, z) => V[l].slice(a, z)));
      assert.equal(t(res.blocks[1]), h.splitUnits(V[l])[1].reduce((a, z) => V[l].slice(a, z)));
      assert.equal(t(res.blocks[2]), h.splitUnits(V[l])[2].reduce((a, z) => V[l].slice(a, z)));
    }
    // bold of sentence 3 moved with it, onto the last piece, in every script
    const last = res.blocks[2];
    for (const l of LANGS) assert.equal((l === base ? last.text : last.tr[l]).slice(...last.bold[l][0]), (l === base ? last.text : last.tr[l]));
    assert.ok(res.blocks.every((x) => x.align === undefined || alignStatus(x, base) === "mapped" || alignStatus(x, base) === "single"));
  }
});

test("headings: refused from a translated version and when the mapping is not certain; level changes and back to paragraph work", () => {
  const b = ensureAlign(mk("en"), "en");
  const fromHi = setLineHeading([b], "en", [sel(b, "en", "hi", 1)], 2);
  assert.match(fromHi.error, /original/);
  assert.equal(fromHi.blocks[0], b);
  const odd = mk("en"); odd.tr.hi = V.hi + " एक और।";
  assert.match(setLineHeading([odd], "en", [sel(odd, "en", "en", 1)], 2).error, /match/);
  const h2 = setLineHeading([b], "en", [sel(b, "en", "en", 0)], 2).blocks;
  assert.equal(h2[0].level, 2);
  assert.equal(setLineHeading(h2, "en", [{ blockId: "b1", lang: "en", start: 0, end: 3 }], 3).blocks[0].level, 3);
  assert.equal(setLineHeading(h2, "en", [{ blockId: "b1", lang: "en", start: 0, end: 3 }], 0).blocks[0].type, "text");
  // a block with only one written version is split on the source alone
  const solo = setLineHeading([{ id: "z", type: "text", text: V.en }], "en", [sel({ id: "z", text: V.en }, "en", "en", 1)], 3);
  assert.deepEqual(solo.blocks.map((x) => x.type), ["text", "heading", "text"]);
});
