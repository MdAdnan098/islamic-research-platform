import { inheritMarks, withoutVersionMarks } from "./highlights.js";

/**
 * Multi-script versions. An article keeps ONE structure (blocks). Text blocks
 * (heading / paragraph / non-sacred quote) carry `tr: { en, hi, ur }` with the
 * same text in the other scripts; article.titleTr does the same for the title.
 * `article.language` is the language the base text was written in.
 */
export const VERSION_LANGS = [["en", "Roman"], ["hi", "Hindi"], ["ur", "Urdu"]];
export const targetLangs = (base) => VERSION_LANGS.filter(([c]) => c !== base);
/** Text to show for `want`; falls back to the base text when that version is missing. */
export const pickVersion = (base, tr, baseLang, want) => (want === baseLang ? base : (tr?.[want]?.trim() ? tr[want] : base));

/** The fields of a reference (book / author / volume / page / text) that are converted along with the post. */
const REF_FIELDS = [["book", "Book"], ["author", "Author"], ["volume", "Volume"], ["page", "Page"], ["referenceText", "Text"]];

/**
 * A reference block points at a shared reference (book name, author ...). The converted versions are kept ON THE BLOCK
 * (`block.tr[lang] = { book, author, ... }`), so the shared reference itself is never changed.
 */
export const isRefBlock = (b) => b.type === "reference" && !!b.referenceId;

/** The reference to show for `want`: the converted fields of the block (when present) over the original reference. */
export function pickRef(ref, tr, baseLang, want) {
  if (!ref || want === baseLang) return ref;
  const t = tr?.[want];
  if (!t) return ref;
  const over = {};
  for (const [k] of REF_FIELDS) if (typeof t[k] === "string" && t[k].trim()) over[k] = t[k].trim();
  return { ...ref, ...over };
}

/** "Book: x / Author: y ..." (the way ChatGPT answers a reference block) -> { book, author, volume, page, referenceText }. */
export function parseRefBlock(str) {
  const byLabel = Object.fromEntries(REF_FIELDS.map(([k, l]) => [l.toLowerCase(), k]));
  const re = /^[\s>*_#\-]*(book|author|volume|page|text)[\s*_]*[:：][\s*_]*(.*)$/i;
  const out = {};
  let cur = null;
  for (const line of String(str || "").split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) { cur = byLabel[m[1].toLowerCase()]; out[cur] = m[2].trim(); }
    else if (cur && line.trim()) out[cur] = `${out[cur]}\n${line.trim()}`.trim();
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

export const isConvertible = (b) =>
  (b.type === "heading" || b.type === "text" || (b.type === "quote" && !["ayat", "hadith"].includes(b.kind))) && String(b.text || "").trim().length > 0;

/** Which script the admin wrote the post in (Latin -> "en", Devanagari -> "hi", Arabic script -> "ur"). */
export function detectLang(title, blocks) {
  const sample = [title, ...blocks.filter(isConvertible).map((b) => b.text)].join(" ");
  let ar = 0, de = 0, la = 0;
  for (const ch of sample) {
    if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ch)) ar++;
    else if (/[\u0900-\u097F]/.test(ch)) de++;
    else if (/[A-Za-z]/.test(ch)) la++;
  }
  if (!ar && !de && !la) return null; // nothing written yet
  return ar >= de && ar >= la ? "ur" : de > la ? "hi" : "en";
}

const SCRIPT = {
  en: {
    name: "Roman Urdu",
    short: "Roman Urdu",
    rule: "Write EVERYTHING in Roman Urdu: Urdu written with English (Latin) letters a-z, the way people type Urdu on a phone. Do NOT use Urdu (Arabic-script) letters or Hindi (Devanagari) letters.",
    sample: "Allah ne ilm hasil karne ka hukm diya hai.",
  },
  hi: {
    name: "Hindi (Devanagari script)",
    short: "Hindi",
    rule: "Write EVERYTHING in Devanagari script (Hindi letters). Do NOT use Roman/English letters or Urdu (Arabic-script) letters.",
    sample: "अल्लाह ने इल्म हासिल करने का हुक्म दिया है।",
  },
  ur: {
    name: "Urdu (Arabic script, Nastaliq, written right-to-left)",
    short: "Urdu",
    rule: "Write EVERYTHING in Urdu script (Arabic-script letters, right-to-left). Do NOT write Roman/English letters (a-z) and do NOT write Devanagari. If your answer is still in Roman letters, it is WRONG: redo it in Urdu script.",
    sample: "اللہ نے علم حاصل کرنے کا حکم دیا ہے۔",
  },
};

/**
 * Numbered text for the admin to give to ChatGPT / Gemini. [0] = title, [n] = block n.
 * The instructions are in plain English with the target script stated first, repeated at the end and shown with an
 * example, because chat models otherwise tend to answer in the script of the text they were given (Roman).
 */
export function buildCopyText(lang, title, blocks, baseLang, refs = {}) {
  const to = SCRIPT[lang];
  const from = SCRIPT[baseLang] || SCRIPT.en;
  const items = [];
  if (title.trim()) items.push(["0", title.trim()]);
  blocks.forEach((b, i) => {
    if (isConvertible(b)) items.push([String(i + 1), String(b.text).trim()]);
    else if (isRefBlock(b) && refs[b.referenceId]) {
      const r = refs[b.referenceId];
      const lines = REF_FIELDS.filter(([k]) => String(r[k] ?? "").trim()).map(([k, l]) => `${l}: ${String(r[k]).trim()}`);
      if (lines.length) items.push([String(i + 1), lines.join("\n")]);
    }
  });
  const first = items[0]?.[0] ?? "1";
  const parts = [
    `TASK: Convert the text below from ${from.name} into ${to.name}.`,
    "",
    `TARGET SCRIPT: ${to.name}`,
    to.rule,
    "",
    "Example of the same sentence:",
    `Input (${from.short}): ${from.sample}`,
    `Output (${to.short}): ${to.sample}`,
    "",
    "RULES:",
    "1. This is NOT a translation. Only the script changes. Keep every word exactly as the author wrote it (Urdu-style words stay Urdu-style). Example: if the source says \"alfaaz\", Hindi output is \"अल्फ़ाज़\" and Urdu output is \"الفاظ\", never \"शब्द\". Never use pure (Sanskrit) Hindi words and never swap words for synonyms: the readers are Muslims.",
    "2. Keep every [number] marker exactly as it is, in the same order. Convert only the text under each marker. Do not merge, split, skip or reorder anything.",
    "3. Keep Arabic text (Quran, hadith, Arabic phrases) unchanged.",
    "4. If the source has an obvious spelling mistake, write the corrected spelling. Do not copy the mistake.",
    "5. A block that has lines starting with Book:, Author:, Volume:, Page:, Text: is a book reference. Keep those five labels in English, each on its own line, and convert only what comes after each label. Numbers stay as they are.",
    "6. Reply with ONLY the converted blocks. No introduction, no explanation, no notes, no code block, no bold or other markdown.",
    `7. The whole answer must be in ${to.name}. Start your answer directly with [${first}].`,
    "",
    "TEXT TO CONVERT:",
    "",
  ];
  items.forEach(([n, text]) => parts.push(`[${n}]`, text, ""));
  return parts.join("\n");
}

/**
 * "[3] text..." or "[3]\ntext..." -> { 3: "text..." }
 * ChatGPT often puts the text on the same line as the marker, or drops line
 * breaks, so markers are found anywhere in the text. To avoid false hits (e.g.
 * "[1]" used as a footnote inside a paragraph) a marker only counts when its
 * number is higher than the previous one and not above `max`.
 */
export function parsePaste(text, max = Infinity) {
  const marks = [];
  let last = -1, m;
  const re = /[\[【]\s*(\d+)\s*[\]】]/g;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n > last && n <= max) { marks.push({ n, start: m.index, end: m.index + m[0].length }); last = n; }
  }
  const out = {};
  marks.forEach((k, i) => {
    const body = text.slice(k.end, i + 1 < marks.length ? marks[i + 1].start : text.length);
    out[k.n] = body.replace(/^[ \t]*[:：.\-–]?[ \t]*/, "").trim();
  });
  return out;
}

export function applyPaste(lang, parsed, titleTr, blocks, baseLang) {
  let count = 0;
  const next = blocks.map((b, i) => {
    const v = parsed[i + 1];
    if (v && isRefBlock(b)) {
      const fields = parseRefBlock(v);
      if (!fields.book && !fields.author && !fields.referenceText) return b;
      count++;
      return { ...b, tr: { ...(b.tr || {}), [lang]: fields } };
    }
    if (!v || !isConvertible(b)) return b;
    count++;
    // A pasted translation replaces that version's text, so highlights that belonged to the old text are dropped.
    // If the other versions are already highlighted, the same lines get highlighted in the pasted one too.
    return inheritMarks(withoutVersionMarks({ ...b, tr: { ...(b.tr || {}), [lang]: v } }, lang), baseLang, lang);
  });
  let tt = titleTr || {};
  if (parsed[0]) { tt = { ...tt, [lang]: parsed[0] }; count++; }
  return { blocks: next, titleTr: tt, count };
}
