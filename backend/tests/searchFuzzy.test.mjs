// Run: cd backend && node --test tests/searchFuzzy.test.mjs   (no database needed: the MongoDB query is built from the same
// matchPlan / tokenAlternatives that makeMatcher runs in JS, and the stored fields come from the real buildArticleSearchFields)
import assert from "node:assert/strict";
import test from "node:test";
import { buildArticleSearchFields, buildNameFields, makeMatcher, matchPlan, normalizeForSearch, oneEditRegex, parseSearchQuery, phoneticNameMatch, phoneticQueryTokens, soundKey } from "../src/utils/searchText.js";
import { FOLDERS, NEGATIVES, POSTS } from "./fixtures/searchCorpus.mjs";

const key = (w) => soundKey(normalizeForSearch(w));

test("sound key: spelling variants of one name meet in every script", () => {
  for (const w of ["muaviya", "muwaviya", "movaiya", "muawiya", "moaviya", "muavia", "mawiya", "moavia", "معاویہ", "मुआविया"]) assert.equal(key(w), "mw", w);
  for (const w of ["yazeed", "yazid", "یزید", "यजीद"]) assert.equal(key(w), "yjd", w);
  for (const w of ["sahih", "صحیح", "सहीह"]) assert.equal(key(w), "sh", w);
  for (const w of ["shah", "شاہ", "शाह"]) assert.equal(key(w), "s", w);
  for (const w of ["wasila", "waseela", "وسیلہ", "वसीला"]) assert.equal(key(w), key("wasila"), w);
  assert.equal(key("khwab"), key("خواب"));
});

test("one-edit regex: one wrong / missing / extra letter, nothing else", () => {
  const re = new RegExp(oneEditRegex("fatiha"));
  for (const w of ["fatiha", "fatihaa", "fatcha", "fatha", "fatiya", "fatihah"]) assert.ok(re.test(` ${w} `), w);
  for (const w of ["fitna", "tiha", "qiyas", "fatwaa", "fahisha"]) assert.equal(re.test(` ${w} `), false, w);
  assert.ok(re.test(" fatima "), "fatima is exactly one letter away from fatiha: near-names on titles are a known, accepted trade-off");
  assert.ok(re.test("fatiha ke"), "word at the start of the field");
  assert.ok(!re.test("xxfatiha") && !re.test(" xxfatiha "), "two extra letters are two edits");
  assert.ok(!re.test("axfatiha") && !re.test("abc fatwa"), "never matches in the middle of another word");
});

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = rng(2026);
const pick = (a) => a[Math.floor(R() * a.length)];
const STOP = new Set("ka ki ke aur ya mein ko se par wa e al ul un bin".split(" ").concat(["و", "اور", "کا", "کی", "کے", "یا", "میں", "سے", "پر", "और", "का", "की", "के", "या", "में", "से", "पर", "व", "ए", "ال"]));
const words = (s) => normalizeForSearch(s).split(" ").filter((w) => w && !STOP.has(w) && w.length >= 3);
const vocab = [0, 1, 2].map((i) => [...new Set(POSTS.flatMap((p) => words(p[i])))]);
const docs = POSTS.map((p) => {
  const body = [0, 1, 2].map((i) => Array.from({ length: 12 }, () => pick(vocab[i])).join(" "));
  return buildArticleSearchFields({ title: p[0], titleTr: { ur: p[1], hi: p[2] }, blocks: [{ type: "text", text: body[0], tr: { ur: body[1], hi: body[2] } }] });
});
const articleHit = (q, fields) => { const p = parseSearchQuery(q); return p.ok && makeMatcher(p.tokens).test(fields); };
const folderHit = (q, name) => { // the same rule as public.controller.js
  const p = parseSearchQuery(q); if (!p.ok) return false;
  const n = normalizeForSearch(name);
  return n.includes(p.normalized) || p.tokens.every((t) => n.includes(t)) || phoneticNameMatch(n, phoneticQueryTokens(p.normalized)) || makeMatcher(p.tokens).test(buildNameFields(name));
};

const VOW = "aeiou";
const OPS = {
  swapwv: (w) => (w.includes("w") ? w.replace("w", "v") : w.includes("v") ? w.replace("v", "w") : null),
  dropvowel: (w) => { const i = [...w].map((c, k) => (VOW.includes(c) && k > 0 ? k : -1)).filter((k) => k > 0); if (!i.length) return null; const k = pick(i); return w.slice(0, k) + w.slice(k + 1); },
  dupvowel: (w) => { const i = [...w].map((c, k) => (VOW.includes(c) ? k : -1)).filter((k) => k >= 0); if (!i.length) return null; const k = pick(i); return w.slice(0, k) + w[k] + w.slice(k); },
  subvowel: (w) => { const i = [...w].map((c, k) => (VOW.includes(c) ? k : -1)).filter((k) => k >= 0); if (!i.length) return null; const k = pick(i); return w.slice(0, k) + { a: "e", e: "i", i: "e", o: "u", u: "o" }[w[k]] + w.slice(k + 1); },
  dblcons: (w) => { const i = [...w].map((c, k) => (!VOW.includes(c) && c !== "h" && k > 0 ? k : -1)).filter((k) => k > 0); if (!i.length) return null; const k = pick(i); return w.slice(0, k) + w[k] + w.slice(k); },
  droph: (w) => (/[kgst]h/.test(w) ? w.replace(/([kgst])h/, "$1") : null),
  zj: (w) => (/[zjqk]/.test(w) ? w.replace(/[zjqk]/, (c) => ({ z: "j", j: "z", q: "k", k: "q" }[c])) : null),
  aiay: (w) => (/ai/.test(w) ? w.replace("ai", "ay") : /ay/.test(w) ? w.replace("ay", "ai") : null),
  tailh: (w) => (/[aeiou]$/.test(w) ? w + "h" : /ah$/.test(w) ? w.slice(0, -1) : null),
  eei: (w) => (/ee/.test(w) ? w.replace("ee", "i") : /i/.test(w) ? w.replace("i", "ee") : null),
};
const TYPOS = {
  delete: (w) => { const k = 1 + Math.floor(R() * (w.length - 1)); return w.slice(0, k) + w.slice(k + 1); },
  swap: (w) => { const k = 1 + Math.floor(R() * (w.length - 2)); return w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2); },
  subst: (w) => { const k = 1 + Math.floor(R() * (w.length - 1)); return w.slice(0, k) + pick([..."abcdefghilmnoprstuyz"]) + w.slice(k + 1); },
};
function variants(w, table, count, maxOps = 2) {
  const out = new Set();
  for (let tries = 0; tries < 40 && out.size < count; tries++) {
    let v = w;
    for (let j = 0, n = 1 + Math.floor(R() * maxOps); j < n; j++) v = pick(Object.values(table))(v) ?? v;
    if (v !== w && v.length >= 3) out.add(v);
  }
  return [...out];
}

const rate = (list) => Math.round((100 * list.filter(Boolean).length) / list.length);
const results = {};
POSTS.forEach((p, i) => {
  const ro = words(p[0]); if (ro.length < 2) return;
  const [a, b] = ro, add = (k, ok) => (results[k] ||= []).push(ok);
  for (const v of variants(a, OPS, 2)) add("1 word", articleHit(v, docs[i]));
  for (const va of variants(a, OPS, 1)) for (const vb of variants(b, OPS, 1)) add("2 words", articleHit(`${va} ${vb}`, docs[i]));
  for (const va of variants(a, OPS, 1)) add("2 words + junk", articleHit(`${va} ${b.length > 4 ? variants(b, OPS, 1)[0] ?? b : b} sahab`, docs[i]));
  if (a.length >= 5) for (const v of variants(a, TYPOS, 2, 1)) add("typo", articleHit(v, docs[i]));
  const ur = words(p[1]), hi = words(p[2]);
  if (ur.length >= 2) add("urdu", articleHit(ur.slice(0, 2).join(" "), docs[i]));
  if (hi.length >= 2) add("hindi", articleHit(hi.slice(0, 2).join(" "), docs[i]));
});
FOLDERS.forEach(([key2, script, name]) => {
  const p = POSTS[POSTS.findIndex((x) => x[0].startsWith(key2))], ro = words(p[0]), ur = words(p[1]), hi = words(p[2]);
  const add = (k, ok) => (results[k] ||= []).push(ok);
  if (script === "ro") {
    for (const v of variants(words(name)[0] ?? ro[0], OPS, 2)) add("folder roman", folderHit(v, name));
    add("folder ro<-urdu/hindi", folderHit(ur[0], name)); add("folder ro<-urdu/hindi", folderHit(hi[0], name));
  } else for (const v of variants(ro[0], OPS, 2)) add("folder urdu/hindi<-roman", folderHit(v, name));
});

if (process.env.SHOW) for (const [k, v] of Object.entries(results)) console.log(k.padEnd(28), `${rate(v)}%`, `(n=${v.length})`);

// Measured with this exact corpus + seed: 1 word 99, 2 words 100, 2 words + junk 84, typo 94, urdu/hindi 100, folder roman 100,
// folder ro<-urdu/hindi 98, folder urdu/hindi<-roman 100. Before the change the same kinds of queries found 46 / 33 / 2 / 41 / 100 / 52 / 48 / 50 %.
const FLOOR = { "1 word": 95, "2 words": 90, "2 words + junk": 75, typo: 88, urdu: 100, hindi: 100, "folder roman": 95, "folder ro<-urdu/hindi": 92, "folder urdu/hindi<-roman": 90 };
for (const [k, floor] of Object.entries(FLOOR)) test(`misspelled queries (${k}) still find the right post / folder: at least ${floor}%`, () => assert.ok(rate(results[k]) >= floor, `${k}: ${rate(results[k])}% (n=${results[k].length})`));

test("random speech and unrelated words stay out (at most a few near-misses)", () => {
  let shown = 0;
  for (const q of NEGATIVES) if (docs.some((d) => articleHit(q, d)) || FOLDERS.some(([, , nm]) => folderHit(q, nm))) shown++;
  assert.ok(shown <= 5, `${shown} of ${NEGATIVES.length} unrelated queries showed something`);
  // the rule that was already tested for folders keeps holding
  for (const s of ["hello", "babu sahab", "lund fund hello good bye"]) assert.equal(folderHit(s, "Wasila"), false, s);
});

test("the Muaviya example: every spelling finds the post and the folder, in all three scripts", () => {
  const post = buildArticleSearchFields({ title: "Sahaba kiram aur Muaviya ka maqam", titleTr: { ur: "صحابہ کرام اور معاویہ کا مقام", hi: "सहाबा किराम और मुआविया का मक़ाम" }, blocks: [] });
  for (const q of ["muaviya", "muwaviya", "movaiya", "muawiya", "moaviya", "muavia", "mawiya", "معاویہ", "मुआविया", "sahaba movaiya"]) {
    assert.ok(articleHit(q, post), `post: ${q}`);
    assert.ok(folderHit(q, "Muwaviya") || q === "sahaba movaiya", `folder: ${q}`);
  }
});

test("3+ words: small words never count, any two real words are enough; one real word must match", () => {
  const post = buildArticleSearchFields({ title: "Namaz mein haath kahan baandhein", titleTr: {}, blocks: [] });
  assert.ok(articleHit("namaz ka tariqa haath", post));      // 2 of the 4+ letter words ("namaz", "haath") match, "tariqa" does not
  assert.ok(articleHit("namaz ki haath", post));
  assert.equal(articleHit("tariqa ki dua", post), false);    // nothing real matches
  assert.equal(articleHit("namaz ke mausam ki", post), false); // only one real word matches and another real word does not -> needs both
  assert.equal(makeMatcher(["namaz", "ka"]).plan.kind, "all"); // 1-2 words: every word
  assert.equal(matchPlan(["namaz", "ka", "haath"]).kind, "pairs");
});
