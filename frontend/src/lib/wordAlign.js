import { normalizeForSearch, skeletonOf, soundKey } from "./searchText.js";
import { unitMap, versionTexts } from "./highlights.js";

/**
 * Word-by-word matching between the Roman, Hindi and Urdu versions of a block - so a single word, a few words or one line of a
 * long sentence in the ORIGINAL version lands on exactly the same words of the other versions.
 *
 * Roman (Urdu), Urdu and Hindi are the same language in three scripts: the words come in the same order and sound the same.
 * Every word is turned into its sound key (lib/searchText.js: ilm = علم = इल्म, muaviya = معاویہ = मुआविया, ...) and the two word lists
 * are aligned like DNA sequences (global alignment): equal sounds pair up, extra / merged / split words become gaps, and nothing is
 * ever paired by position or by counting. No dictionary, no translation, no AI.
 *
 * It never guesses: a selection is only carried over when its own words pair up with enough certainty (see mapRange) and the two texts
 * are clearly the same text overall; otherwise that version is reported as "not matched" and keeps no formatting from this action.
 */
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;
const MAX_CELLS = 1_500_000;      // cells of the (banded) table; a block is never this long - beyond it nothing is matched, so it can never be slow
const MIN_SELECTED_MATCHED = 0.6; // of the words you selected, at least this share must find their partner
const MIN_TEXT_MATCHED = 0.5;     // of the words of BOTH texts, at least this share must pair up (else they are not the same text)

const IDS = new Map();
const id = (str) => { if (!str) return 0; let x = IDS.get(str); if (x === undefined) { if (IDS.size > 200_000) IDS.clear(); x = IDS.size + 1; IDS.set(str, x); } return x; };
const mk = (n) => { const k = soundKey(n), sk = skeletonOf(n); return { n, k, sk, ni: id(n), ki: id(k), si: id(sk) }; };

/** [{ s, e, n, k, sk, ... }]: every word with its offsets, normalised form, sound key and consonant skeleton. */
export function wordsOf(text) {
  const out = [];
  for (const m of text.matchAll(WORD_RE)) {
    const n = normalizeForSearch(m[0]);
    if (!n) continue;
    out.push({ s: m.index, e: m.index + m[0].length, ...mk(n) });
  }
  return out;
}

const edit1 = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length < b.length ? a.slice(i) === b.slice(i + 1) : a.slice(i + 1) === b.slice(i);
};

/** How well two words match, in half-points: 8 identical, 6 same sound key, 5 same skeleton, 3 close sound key, < 0 no match. */
export function similarity(a, b) {
  if (a.ni === b.ni) return 8;
  if (a.ki && a.ki === b.ki) return 6;
  if (a.si && a.si === b.si) return 5;
  const x = a.k, y = b.k;
  if (x.length >= 3 && y.length >= 3 && (x[0] === y[0] || x[x.length - 1] === y[y.length - 1]) && (edit1(x, y) || x.startsWith(y) || y.startsWith(x))) return 3;
  return -6;
}
const GAP = -2;

/** A word made of two neighbours written together or apart (iski = اس کی, dekh kar = देखकर): same-sound test only. */
const glue = (a, b) => mk(a.n + b.n);
function mergeSimilarity(one, g) {
  if (one.ki && one.ki === g.ki && one.k.length >= 2) return 6;
  if (one.si && one.si === g.si && one.sk.length >= 2) return 5;
  return -6;
}

/**
 * Global alignment of two word lists. Returns { pairs: Map(sourceIndex -> [firstTargetIndex, lastTargetIndex]), srcShare, tgtShare, crossed }
 * or null when too long. (Needleman-Wunsch with a linear gap cost, plus "one word = two words" moves; ties prefer the plain
 * one-to-one step, so repeated small words (ka, ke, hai) keep their order. Only a band around the diagonal is filled in: the three
 * scripts keep the same order, so the right path never wanders far from it - this keeps long blocks fast.)
 */
export function alignWords(src, tgt) {
  const n = src.length, m = tgt.length;
  if (!n || !m) return null;
  const band = Math.max(30, Math.ceil(0.2 * Math.max(n, m)));
  if (n * (2 * band + 1) > MAX_CELLS) return null;
  const sGlue = src.map((w, i) => (i ? glue(src[i - 1], w) : null)); // sGlue[i] = words i-1 and i written together
  const tGlue = tgt.map((w, j) => (j ? glue(tgt[j - 1], w) : null));
  const W = m + 1, NEG = -1e8;
  const score = new Int32Array((n + 1) * W).fill(NEG);
  const back = new Uint8Array((n + 1) * W); // 1 one-to-one, 2 source word without partner, 3 target word without partner, 4 one source = two target, 5 two source = one target
  score[0] = 0;
  for (let i = 1; i <= n; i++) { score[i * W] = i * GAP; back[i * W] = 2; }
  for (let j = 1; j <= m; j++) { score[j] = j * GAP; back[j] = 3; }
  for (let i = 1; i <= n; i++) {
    const c = Math.round((i * m) / n);
    const lo = Math.max(1, c - band), hi = Math.min(m, c + band);
    for (let j = lo; j <= hi; j++) {
      let best = score[(i - 1) * W + j - 1] + similarity(src[i - 1], tgt[j - 1]), dir = 1;
      const u = score[(i - 1) * W + j] + GAP; if (u > best) { best = u; dir = 2; }
      const l = score[i * W + j - 1] + GAP; if (l > best) { best = l; dir = 3; }
      if (j >= 2) { const v = score[(i - 1) * W + j - 2] + mergeSimilarity(src[i - 1], tGlue[j - 1]); if (v > best) { best = v; dir = 4; } }
      if (i >= 2) { const v = score[(i - 2) * W + j - 1] + mergeSimilarity(tgt[j - 1], sGlue[i - 1]); if (v > best) { best = v; dir = 5; } }
      score[i * W + j] = best; back[i * W + j] = dir;
    }
  }
  const pairs = new Map();
  let matchedSrc = 0, matchedTgt = 0;
  for (let i = n, j = m; i > 0 || j > 0;) {
    const dir = back[i * W + j];
    if (dir === 1 && i > 0 && j > 0) { if (similarity(src[i - 1], tgt[j - 1]) > 0) { pairs.set(i - 1, [j - 1, j - 1]); matchedSrc++; matchedTgt++; } i--; j--; }
    else if (dir === 4 && i > 0 && j > 1) { pairs.set(i - 1, [j - 2, j - 1]); matchedSrc++; matchedTgt += 2; i--; j -= 2; }
    else if (dir === 5 && i > 1 && j > 0) { pairs.set(i - 1, [j - 1, j - 1]); pairs.set(i - 2, [j - 1, j - 1]); matchedSrc += 2; matchedTgt++; i -= 2; j--; }
    else if (dir === 2 && i > 0) i--;
    else j--;
  }
  const srcShare = matchedSrc / n, tgtShare = matchedTgt / m; // judged on real sound matches only
  const crossed = findCrossings(src, tgt, pairs);
  fillGaps(pairs, n, m, crossed);
  return { pairs, srcShare, tgtShare, crossed };
}

/**
 * Reordering check. A word left without a partner on the source side and a word left without a partner on the target side that SOUND
 * the same cannot both be explained by "extra word": the sentence was reordered (Allah ne Quran ko Ramzan mein ... = रमज़ान में ... अल्लाह ने ...).
 * Small words (ne, ko, ka) are only believed when two in a row do it. The reordered stretch, plus one word on each side of it, is
 * remembered as a no-go region on each side: nothing is carried over from or into it (a refusal is better than a wrong word).
 */
function findCrossings(src, tgt, pairs) {
  const usedT = new Set();
  for (const [lo, hi] of pairs.values()) for (let j = lo; j <= hi; j++) usedT.add(j);
  const freeS = new Set(src.map((_, i) => i).filter((i) => !pairs.has(i)));
  const freeT = new Set(tgt.map((_, j) => j).filter((j) => !usedT.has(j)));
  const eq = (i, j) => similarity(src[i], tgt[j]) >= 5;
  const crossS = new Set(), crossT = new Set();
  for (const i of freeS) for (const j of freeT) {
    if (!eq(i, j)) continue;
    const strong = src[i].k.length >= 2 || src[i].n === tgt[j].n
      || (freeS.has(i + 1) && freeT.has(j + 1) && eq(i + 1, j + 1)) || (freeS.has(i - 1) && freeT.has(j - 1) && eq(i - 1, j - 1));
    if (strong) { crossS.add(i); crossT.add(j); }
  }
  const regions = (set) => {
    const out = [];
    for (const x of [...set].sort((p, q) => p - q)) {
      const last = out[out.length - 1];
      if (last && x - last[1] <= 3) last[1] = x; else out.push([x, x]);
    }
    return out.map(([x, y]) => [x - 1, y + 1]);
  };
  return { crossS, crossT, regionsS: regions(crossS), regionsT: regions(crossT) };
}
const inRegions = (list, lo, hi) => list.some(([x, y]) => lo <= y && hi >= x);

const MAX_GAP = 3;
/**
 * Two languages sometimes use a different word for the same thing (bina = بغیر = बिना is not a spelling difference). Such words
 * cannot match by sound, but they sit BETWEEN two firmly matched words on both sides. When the leftover words between the same two
 * anchors are few (up to 3) on both sides, they are taken as each other: one-to-one in order if equally many, else as one group.
 */
function fillGaps(pairs, n, m, crossed) {
  const anchors = [...pairs.keys()].sort((x, y) => x - y);
  if (!anchors.length) return;
  const edges = [{ i: -1, hi: -1 }, ...anchors.map((i) => ({ i, lo: pairs.get(i)[0], hi: pairs.get(i)[1] })), { i: n, lo: m }];
  for (let k = 0; k + 1 < edges.length; k++) {
    const U = [], V = [];
    for (let i = edges[k].i + 1; i < edges[k + 1].i; i++) U.push(i);
    for (let j = edges[k].hi + 1; j < edges[k + 1].lo; j++) V.push(j);
    if (!U.length || !V.length || U.length > MAX_GAP || V.length > MAX_GAP) continue;
    if (U.some((i) => crossed.crossS.has(i)) || V.some((j) => crossed.crossT.has(j))) continue; // reordered: never pair by position
    if (U.length === V.length) U.forEach((i, x) => pairs.set(i, [V[x], V[x]]));
    else U.forEach((i) => pairs.set(i, [V[0], V[V.length - 1]]));
  }
}

/**
 * Carries the selection [s, e) of `srcText` over to `tgtText`: { range: [start, end], missed } in tgtText (`missed` = how many selected words
 * found no partner and therefore stay unformatted there), or { fail: reason }.
 * Reasons: "same" (the texts do not look like the same text), "words" (the selected words did not find their partners),
 * "span" (their partners are scattered), "order" (the sentence is ordered differently), "empty", "long".
 */
export function mapRange(srcText, tgtText, [s, e], cache) {
  const key = cache && `${srcText.length}|${tgtText.length}|${srcText.slice(0, 40)}|${tgtText.slice(0, 40)}`;
  let al = cache?.get(key);
  if (!al) {
    const sw = wordsOf(srcText), tw = wordsOf(tgtText);
    const a = alignWords(sw, tw);
    al = { sw, tw, a };
    cache?.set(key, al);
  }
  const { sw, tw, a } = al;
  if (!sw.length || !tw.length) return { fail: "empty" };
  if (!a) return { fail: "long" };
  if (a.srcShare < MIN_TEXT_MATCHED || a.tgtShare < MIN_TEXT_MATCHED) return { fail: "same" };
  const sel = [];
  sw.forEach((w, i) => { if (w.s < e && w.e > s) sel.push(i); });
  if (!sel.length) return { fail: "words" };
  if (inRegions(a.crossed.regionsS, sel[0], sel[sel.length - 1])) return { fail: "order" };
  const got = sel.filter((i) => a.pairs.has(i));
  if (!got.length || got.length / sel.length < MIN_SELECTED_MATCHED) return { fail: "words" };
  const js = got.flatMap((i) => a.pairs.get(i));
  const lo = Math.min(...js), hi = Math.max(...js);
  if (hi - lo + 1 > 2 * sel.length + 3) return { fail: "span" };
  if (inRegions(a.crossed.regionsT, lo, hi)) return { fail: "order" };
  let from = tw[lo].s, to = tw[hi].e;
  // punctuation that is part of the selection (a closing full stop, an opening quote) comes along with its partner word
  const NOT_WORD = /[^\p{L}\p{M}\p{N}\s]/u;
  const lastSel = sw[sel[sel.length - 1]], firstSel = sw[sel[0]];
  if (e > lastSel.e && NOT_WORD.test(srcText.slice(lastSel.e, e))) while (to < tgtText.length && NOT_WORD.test(tgtText[to])) to++;
  if (s < firstSel.s && NOT_WORD.test(srcText.slice(s, firstSel.s))) while (from > 0 && NOT_WORD.test(tgtText[from - 1])) from--;
  return { range: [from, to], missed: sel.length - got.length };
}

/**
 * Where a selection of the ORIGINAL version of block `b` lands in every other written version.
 * Works inside the stored line mapping when there is one (a whole line -> the matching whole line; a part of a line -> the words of that
 * line only), otherwise on the whole block. Returns
 *   { spans: [{ lang, range }]   one range per version that could be matched (never includes the source itself),
 *     failed: [lang]             versions that were NOT matched (nothing is applied there),
 *     missed: { lang: n }        versions matched, but n of the selected words found no partner there,
 *     usedUnits, persisted }.
 */
export function mapSelection(b, baseLang, sel, cache = new Map()) {
  const texts = versionTexts(b, baseLang);
  const targets = Object.keys(texts).filter((l) => l !== baseLang);
  const out = { spans: [], failed: [], missed: {}, usedUnits: false, persisted: true };
  if (!texts[baseLang] || !targets.length) return out;
  const [s, e] = sel;
  const src = texts[baseLang];
  const um = unitMap(b, baseLang);
  let pieces = [];
  if (um?.aligned) {
    um.versions[baseLang].forEach((r, i) => { if (r[0] < e && r[1] > s) pieces.push(i); });
    if (pieces.length) { out.usedUnits = true; out.persisted = um.persisted; }
  }
  for (const lang of targets) {
    const ranges = [];
    let ok = true, missed = 0;
    if (pieces.length) {
      for (const i of pieces) {
        const r = um.versions[baseLang][i], t = um.versions[lang][i];
        let end = r[1]; // the line without its closing punctuation
        while (end > r[0] && /[.!?।۔؟"'”’)»\]\s]/.test(src[end - 1])) end--;
        if (s <= r[0] && e >= Math.max(end, r[0] + 1)) { ranges.push(t); continue; } // the whole line: its partner line, exactly
        const res = mapRange(src.slice(r[0], r[1]), texts[lang].slice(t[0], t[1]), [Math.max(s, r[0]) - r[0], Math.min(e, r[1]) - r[0]], cache);
        if (res.fail) { ok = false; break; }
        missed += res.missed;
        ranges.push([res.range[0] + t[0], res.range[1] + t[0]]);
      }
    } else {
      const res = mapRange(src, texts[lang], sel, cache);
      if (res.fail) ok = false; else { ranges.push(res.range); missed += res.missed; }
    }
    if (!ok) { out.failed.push(lang); continue; }
    if (missed) out.missed[lang] = missed;
    ranges.sort((x, y) => x[0] - y[0]);
    const merged = []; // neighbouring lines that are only a space apart become one range (no blank gap in a highlight)
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && !texts[lang].slice(last[1], r[0]).trim()) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
    }
    for (const r of merged) out.spans.push({ lang, range: r });
  }
  return out;
}
