// Word-level matching between Roman / Hindi / Urdu: a word, a few words or one line of a long sentence lands on the same words of the other scripts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as h from "../src/lib/highlights.js";
import { planEdits } from "../src/lib/formatPlan.js";
import { inverseEdits } from "../src/lib/formatPlan.js";
import { mapRange, mapSelection, wordsOf } from "../src/lib/wordAlign.js";
import { HARD } from "./fixtures/paragraphsHard.mjs";
import { LANGS, PARAGRAPHS, build } from "./fixtures/paragraphs.mjs";

/** Every run of 1..8 consecutive word-groups, from every script to every other: how often is the carried-over range exactly right? */
function measure(sets) {
  const r = { total: 0, exact: 0, wrong: 0, partial: 0, refused: 0, wrongList: [] };
  sets.forEach(({ groups: par, order }, pi) => {
    const { text, groups } = build(par, order);
    for (const src of LANGS) for (const tgt of LANGS) {
      if (src === tgt) continue;
      for (let g0 = 0; g0 < par.length; g0++) for (let len = 1; len <= 8 && g0 + len <= par.length; len++) {
        const run = groups.slice(g0, g0 + len);
        if (run.some((g) => !g[src])) continue;
        const ts = run.filter((g) => g[tgt]); if (!ts.length) continue;
        const a = Math.min(...ts.map((g) => g[tgt][0])), z = Math.max(...ts.map((g) => g[tgt][1]));
        if (groups.some((g, k) => g[tgt] && g[src] && g[tgt][0] >= a && g[tgt][1] <= z && (k < g0 || k >= g0 + len))) continue; // reordered: no single right answer
        const sel = [run[0][src][0], run[run.length - 1][src][1]];
        const res = mapRange(text[src], text[tgt], sel); r.total++;
        if (res.fail) r.refused++;
        else if (res.range[0] === a && res.range[1] === z) r.exact++;
        else if (res.missed > 0 && res.range[0] >= a && res.range[1] <= z) r.partial++; // narrower, inside the right words, and reported as "missed"
        else { r.wrong++; r.wrongList.push(`p${pi} ${src}->${tgt} "${text[src].slice(...sel)}" => "${text[tgt].slice(...res.range)}"`); }
      }
    }
  });
  return r;
}
const pct = (n, d) => (100 * n) / d;

test("normal paragraphs (same text in three scripts, spelling variants, 1 word = 2 words, different words): every selection is carried over exactly", () => {
  const r = measure(PARAGRAPHS.map((groups) => ({ groups, order: {} })));
  assert.ok(r.total > 5000);
  assert.equal(r.wrong, 0, r.wrongList.slice(0, 5).join("\n"));
  assert.ok(pct(r.exact, r.total) >= 99, `exact ${pct(r.exact, r.total).toFixed(1)}%`);
});

test("hard held-out set (Hindi synonyms, a reordered sentence, extra words, Arabic phrases): never a wrong place; almost always exact", () => {
  const r = measure(HARD);
  assert.ok(r.total > 3000);
  assert.equal(r.wrong, 0, r.wrongList.slice(0, 5).join("\n")); // a refusal is fine, a wrong word is not
  assert.ok(pct(r.exact, r.total) >= 93, `exact ${pct(r.exact, r.total).toFixed(1)}%`);
  assert.ok(pct(r.refused, r.total) <= 6, `refused ${pct(r.refused, r.total).toFixed(1)}%`);
});

test("texts that are not the same text are refused outright", () => {
  const roman = "Zakat aur sadqa e fitr ke masail ka bayan hai.";
  const other = "یہ ایک بالکل مختلف عبارت ہے جس کا اوپر والی بات سے کوئی تعلق نہیں۔";
  assert.equal(mapRange(roman, other, [0, 5]).fail, "same");
  assert.equal(mapRange("", other, [0, 1]).fail, "empty");
});

test("a long 2-3 line sentence: one word, 3 words, one line and the whole sentence reach Hindi and Urdu word for word", () => {
  const { text, groups } = build(PARAGRAPHS[2]);
  const b = { id: "w", type: "text", text: text.en, tr: { hi: text.hi, ur: text.ur } };
  const g = (a, z, l) => [groups[a][l][0], groups[z][l][1]];
  const cases = [[0, 0], [14, 16], [11, 13], [26, 30], [0, groups.length - 1]]; // a word, 3 words, a phrase, a few words, everything
  for (const [a, z] of cases) {
    const start = g(a, z, "en");
    for (const [mode, field] of [["add", "hl"], ["add", "hlGreen"], ["add", "bold"], ["add", "tcRed"], ["size", 125]]) {
      const r = planEdits({ blocks: [b], baseLang: "en", pieces: [{ blockId: "w", lang: "en", start: start[0], end: start[1] }], mode, field });
      const next = h.applyEdits([b], r.edits)[0];
      const layer = mode === "size" ? "sz125" : field;
      for (const l of ["hi", "ur"]) {
        const want = g(a, z, l);
        assert.deepEqual(next[layer][l], [want], `${layer} groups ${a}-${z} in ${l}`);
      }
      assert.deepEqual(next[layer].en, [start]);
      assert.deepEqual(r.notes, []);
    }
  }
});

test("ONE word to the H3 size changes only that word (never the whole sentence), in all three scripts; the other words stay untouched", () => {
  const { text, groups } = build(PARAGRAPHS[0]);
  const b = { id: "w", type: "text", text: text.en, tr: { hi: text.hi, ur: text.ur } };
  const [s, e] = groups[10].en; // "zer-e-behas"... use a single plain word instead
  const one = groups[9].en;     // "darmiyan"
  const r = planEdits({ blocks: [b], baseLang: "en", pieces: [{ blockId: "w", lang: "en", start: one[0], end: one[1] }], mode: "size", field: 125 });
  const next = h.applyEdits([b], r.edits)[0];
  assert.equal(next.text.slice(...next.sz125.en[0]), "darmiyan");
  assert.equal(next.tr.hi.slice(...next.sz125.hi[0]), "दरमियान");
  assert.equal(next.tr.ur.slice(...next.sz125.ur[0]), "درمیان");
  assert.equal(next.sz125.en.length + next.sz125.hi.length + next.sz125.ur.length, 3);
  assert.equal(next.type, "text"); // still a paragraph: a size is not a heading
  void s; void e;
});

test("formatting made on a translated version still stays in that version only (all words, all scripts)", () => {
  const { text, groups } = build(PARAGRAPHS[1]);
  const b = { id: "w", type: "text", text: text.en, tr: { hi: text.hi, ur: text.ur } };
  for (const from of ["hi", "ur"]) {
    const sel = groups[3][from];
    const r = planEdits({ blocks: [b], baseLang: "en", pieces: [{ blockId: "w", lang: from, start: sel[0], end: sel[1] }], mode: "add", field: "hlPink" });
    assert.deepEqual(r.edits.filter((e) => e.lang).map((e) => e.lang), [from]);
  }
});

test("source in Hindi or Urdu: a single word reaches the other two", () => {
  const { text, groups } = build(PARAGRAPHS[3]);
  for (const base of ["hi", "ur"]) {
    const others = LANGS.filter((l) => l !== base);
    const b = { id: "w", type: "text", text: text[base], tr: Object.fromEntries(others.map((l) => [l, text[l]])) };
    const sel = groups[12][base]; // "tadad"
    const r = planEdits({ blocks: [b], baseLang: base, pieces: [{ blockId: "w", lang: base, start: sel[0], end: sel[1] }], mode: "add", field: "bold" });
    const next = h.applyEdits([b], r.edits)[0];
    for (const l of others) assert.deepEqual(next.bold[l], [groups[12][l]], `${base} -> ${l}`);
  }
});

test("a reordered sentence or a missing partner is reported, never guessed", () => {
  const { text, groups } = build(HARD[1].groups, HARD[1].order);
  const b = { id: "w", type: "text", text: text.en, tr: { hi: text.hi } };
  const sel = groups[0].en; // "Allah": its Hindi partner stands elsewhere because the sentence is ordered differently
  const r = planEdits({ blocks: [b], baseLang: "en", pieces: [{ blockId: "w", lang: "en", start: sel[0], end: sel[1] }], mode: "add", field: "bold" });
  assert.deepEqual(r.edits.filter((e) => e.lang).map((e) => e.lang), ["en"]);
  assert.equal(r.notes[0].code, "unmatched");
  assert.deepEqual(r.notes[0].langs, ["hi"]);
  // a word without any partner (different word): matched where it can be, flagged for the rest
  const { text: t2, groups: g2 } = build(HARD[0].groups);
  const b2 = { id: "x", type: "text", text: t2.en, tr: { hi: t2.hi, ur: t2.ur } };
  const sel2 = [g2[0].en[0], g2[2].en[1]]; // "Ilm hasil karna har": Hindi says "ज्ञान प्राप्त करना" - different words
  const r2 = planEdits({ blocks: [b2], baseLang: "en", pieces: [{ blockId: "x", lang: "en", start: sel2[0], end: sel2[1] }], mode: "add", field: "bold" });
  const langs = r2.edits.filter((e) => e.lang).map((e) => e.lang);
  assert.ok(langs.includes("en") && langs.includes("ur"));
});

test("undo of a word-level action restores the blocks exactly (all three scripts)", () => {
  const { text, groups } = build(PARAGRAPHS[4]);
  const b = { id: "w", type: "text", text: text.en, tr: { hi: text.hi, ur: text.ur } };
  const sel = groups[5].en;
  const edits = planEdits({ blocks: [b], baseLang: "en", pieces: [{ blockId: "w", lang: "en", start: sel[0], end: sel[1] }], mode: "add", field: "hl" }).edits;
  const after = h.applyEdits([b], edits);
  assert.deepEqual(h.applyEdits(after, inverseEdits([b], edits)), [b]);
});

test("inside a mapped block a whole line still travels through the stored line mapping; a part of a line uses the words of that line only", () => {
  const V = { en: "Allah ek hai. Ilm hasil karna farz hai.", hi: "अल्लाह एक है। इल्म हासिल करना फ़र्ज़ है।", ur: "اللہ ایک ہے۔ علم حاصل کرنا فرض ہے۔" };
  const b0 = { id: "m", type: "text", text: V.en, tr: { hi: V.hi, ur: V.ur } };
  const sentences = h.splitUnits(V.en);
  const whole = mapSelection(b0, "en", sentences[1]);
  assert.equal(whole.usedUnits, true);
  assert.deepEqual(whole.spans.map((x) => x.lang).sort(), ["hi", "ur"]);
  const [a] = sentences[1];
  const word = mapSelection(b0, "en", [a, a + 3]); // "Ilm"
  assert.equal(V.hi.slice(...word.spans.find((x) => x.lang === "hi").range), "इल्म");
  assert.equal(V.ur.slice(...word.spans.find((x) => x.lang === "ur").range), "علم");
  assert.deepEqual(word.failed, []);
});

test("wordsOf: letters, marks and digits are words; punctuation is not", () => {
  const w = wordsOf("Ilm-e-Ghaib (2) हाथ، علم۔");
  assert.deepEqual(w.map((x) => x.n), ["ilm", "e", "ghaib", "2", "हाथ", "علم"]);
});

test("the frontend copy of the sound-key code is identical to the backend file (they must never drift apart)", () => {
  const front = readFileSync(new URL("../src/lib/searchText.js", import.meta.url), "utf8").split("\n").slice(2).join("\n");
  let back;
  try { back = readFileSync(new URL("../../backend/src/utils/searchText.js", import.meta.url), "utf8"); } catch { back = null; }
  if (back === null || !back.includes("export function soundKey")) return; // backend file not present / older: nothing to compare
  assert.equal(front, back);
});

test("a selection whose words mostly have no partner (a paraphrase) is refused, while the matching parts of the same text still work", () => {
  const en = "Allah ek hai aur ham sab ussi ke bande hain. Wo hamara rab hai.";
  const hi = "अल्लाह एक है और इंसानियत जग सारा सृष्टि का प्रत्येक जन उनका भक्त है। वो हमारा रब है।";
  const pick = (t) => { const s = en.indexOf(t); return mapRange(en, hi, [s, s + t.length]); };
  assert.equal(hi.slice(...pick("Allah ek hai").range), "अल्लाह एक है");
  assert.equal(hi.slice(...pick("Wo hamara rab hai.").range), "वो हमारा रब है।");
  assert.equal(pick("aur ham sab ussi").fail, "words");   // 1 of 4 words found a partner: not enough to be sure
  assert.equal(pick("ham sab ussi ke").fail, "words");
});

test("when some selected words are skipped the result says how many (so the toolbar can tell the admin)", () => {
  const en = "Imam Abu Hanifa rahimahullah ne fiqh ki bunyad rakhi.";
  const hi = "इमाम अबू हनीफ़ा ने फ़िक़्ह की बुनियाद रखी।"; // no word for "rahimahullah" in this version
  const s = en.indexOf("Imam"), e = en.indexOf("ne") + 2;
  const r = mapRange(en, hi, [s, e]);
  assert.equal(hi.slice(...r.range), "इमाम अबू हनीफ़ा ने");
  assert.equal(r.missed, 1);
});
