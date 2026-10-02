const LOCALES = { roman: "en-IN", hindi: "hi-IN", urdu: "ur-PK" };

export function formatDate(value, lang = "roman") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] || "en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export function readMinutes(blocks = []) {
  const words = blocks.reduce((n, b) => n + (b.type === "text" || b.type === "quote" ? String(b.text || "").split(/\s+/).length : 0), 0);
  return Math.max(1, Math.round(words / 180));
}

export const slugify = (s = "") =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export const isSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s || "");
