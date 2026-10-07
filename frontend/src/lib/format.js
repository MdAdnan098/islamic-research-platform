export function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
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

export function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}

/** `amount` in major units (rupees). Whole amounts are shown without decimals. */
export function formatPrice(amount, currency = "INR") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
