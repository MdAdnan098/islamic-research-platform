/**
 * Article block model — the backend only validates `type`, so the field
 * shapes below are defined (and owned) by the frontend:
 *
 *  heading   { text, level: 2|3 }
 *  text      { text }                      paragraphs split by blank line
 *  quote     { text, source, kind: "quote"|"ayat"|"hadith" }
 *  reference { referenceId }               resolved via article.references
 *  image     { key, caption, alt }
 *  scan      { pages: [{ key, caption }], caption }
 *  pdf       { key, title }
 *  divider   {}
 */
export const BLOCK_META = {
  heading: { label: "Heading", icon: "H" },
  text: { label: "Paragraph", icon: "¶" },
  quote: { label: "Quote", icon: "❝" },
  reference: { label: "Reference", icon: "§" },
  image: { label: "Image", icon: "▣" },
  scan: { label: "Book Scan", icon: "▤" },
  pdf: { label: "PDF Document", icon: "⎘" },
  divider: { label: "Divider", icon: "—" },
};
export const BLOCK_TYPES = Object.keys(BLOCK_META);

export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `b${Date.now()}${Math.random().toString(16).slice(2)}`);

const DEFAULTS = {
  heading: { text: "", level: 2 },
  text: { text: "" },
  quote: { text: "", source: "", kind: "quote" },
  reference: { referenceId: "" },
  image: { key: "", caption: "", alt: "" },
  scan: { pages: [], caption: "" },
  pdf: { key: "", title: "" },
  divider: {},
};

export const newBlock = (type) => ({ id: uid(), type, ...structuredClone(DEFAULTS[type] || {}) });
export const withIds = (blocks = []) => blocks.map((b) => (b.id ? b : { ...b, id: uid() }));
export const cloneBlocks = (blocks = []) => blocks.map((b) => ({ ...structuredClone(b), id: uid() }));

/** The article's `references` array is derived from its reference blocks. */
export const referenceIdsOf = (blocks = []) => [...new Set(blocks.filter((b) => b.type === "reference" && b.referenceId).map((b) => b.referenceId))];

export const SECTIONS = ["dalail", "radd"];
