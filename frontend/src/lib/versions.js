/**
 * Multi-script versions. An article keeps ONE structure (blocks). Text blocks
 * (heading / paragraph / non-sacred quote) carry `tr: { en, hi, ur }` with the
 * same text in the other scripts; article.titleTr does the same for the title.
 * `article.language` is the language the base text was written in.
 */
export const VERSION_LANGS = [["en", "Roman"], ["hi", "Hindi"], ["ur", "Urdu"]];
export const targetLangs = (base) => VERSION_LANGS.filter(([c]) => c !== base);
const NAMES = { en: "Roman Urdu (Latin script)", hi: "Hindi (Devanagari script)", ur: "Urdu (Nastaliq script)" };

/** Text to show for `want`; falls back to the base text when that version is missing. */
export const pickVersion = (base, tr, baseLang, want) => (want === baseLang ? base : (tr?.[want]?.trim() ? tr[want] : base));

export const isConvertible = (b) =>
  (b.type === "heading" || b.type === "text" || (b.type === "quote" && !["ayat", "hadith"].includes(b.kind))) && String(b.text || "").trim().length > 0;

/** Numbered text for the admin to give to ChatGPT etc. [0] = title, [n] = block n. */
export function buildCopyText(lang, title, blocks) {
  const parts = [
    `Neeche diye gaye har hisse ko ${NAMES[lang]} mein convert karo. Har [number] marker bilkul waise hi rakho, sirf uske neeche ka text convert karo. Arabic text ko mat badlo. Koi explanation mat likho.`,
    "",
  ];
  if (title.trim()) parts.push("[0]", title.trim(), "");
  blocks.forEach((b, i) => { if (isConvertible(b)) parts.push(`[${i + 1}]`, String(b.text).trim(), ""); });
  return parts.join("\n");
}

/** "[3]\ntext..." -> { 3: "text..." } */
export function parsePaste(text) {
  const re = /^[ \t]*\[(\d+)\][ \t]*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ n: Number(m[1]), start: m.index, end: m.index + m[0].length });
  const out = {};
  marks.forEach((k, i) => { out[k.n] = text.slice(k.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim(); });
  return out;
}

export function applyPaste(lang, parsed, titleTr, blocks) {
  let count = 0;
  const next = blocks.map((b, i) => {
    const v = parsed[i + 1];
    if (!v || !isConvertible(b)) return b;
    count++;
    return { ...b, tr: { ...(b.tr || {}), [lang]: v } };
  });
  let tt = titleTr || {};
  if (parsed[0]) { tt = { ...tt, [lang]: parsed[0] }; count++; }
  return { blocks: next, titleTr: tt, count };
}
