import { isRtl, scriptClass, scriptOf } from "../../lib/script.js";

/** Renders a string with the correct font + direction for its own script. */
export function Text({ as: Tag = "p", children, force, className = "", ...rest }) {
  const s = scriptOf(typeof children === "string" ? children : "", force);
  return (
    <Tag dir={isRtl(s) ? "rtl" : "ltr"} lang={s === "urdu" ? "ur" : s === "arabic" ? "ar" : undefined} className={`${scriptClass(s)} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
