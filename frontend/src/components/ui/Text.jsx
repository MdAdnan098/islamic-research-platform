import { isRtl, scriptClass, scriptOf } from "../../lib/script.js";

/* Pasted text (ChatGPT, Word, web pages) often carries non-breaking spaces. They glue every word together,
   so a whole paragraph becomes one unbreakable line. Turn them into normal spaces so text wraps to the screen. */
const NON_BREAKING = /[\u00A0\u2007\u202F\u2060\uFEFF]/g;

/** Renders a string with the correct font + direction for its own script. */
export function Text({ as: Tag = "p", children, force, className = "", ...rest }) {
  if (typeof children === "string") children = children.replace(NON_BREAKING, " ");
  const s = scriptOf(typeof children === "string" ? children : "", force);
  return (
    <Tag dir={isRtl(s) ? "rtl" : "ltr"} lang={s === "urdu" ? "ur" : s === "arabic" ? "ar" : undefined} className={`${scriptClass(s)} break-words ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
