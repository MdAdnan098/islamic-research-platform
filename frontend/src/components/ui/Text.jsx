import { isRtl, scriptClass, scriptOf } from "../../lib/script.js";

/* Pasted text (ChatGPT, Word, web pages) often carries non-breaking spaces. They glue every word together,
   so a whole paragraph becomes one unbreakable line. Turn them into normal spaces so text wraps to the screen. */
const NON_BREAKING = /[\u00A0\u2007\u202F\u2060\uFEFF]/g;

/** Same replacement <Text/> applies. It is 1 character -> 1 character, so highlight offsets are unaffected. */
export const cleanText = (s) => String(s ?? "").replace(NON_BREAKING, " ");

/**
 * Renders a string with the correct font + direction for its own script.
 * `children` may also be an array of strings / <mark> elements (highlighted text); pass the plain text as `src`
 * so the script is still detected from the whole string.
 */
export function Text({ as: Tag = "p", children, src, force, className = "", ...rest }) {
  if (typeof children === "string") children = cleanText(children);
  const s = scriptOf(typeof children === "string" ? children : typeof src === "string" ? src : "", force);
  return (
    <Tag dir={isRtl(s) ? "rtl" : "ltr"} lang={s === "urdu" ? "ur" : s === "arabic" ? "ar" : undefined} className={`${scriptClass(s)} break-words ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
