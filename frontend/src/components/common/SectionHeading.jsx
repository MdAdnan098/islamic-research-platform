/**
 * Consistent "eyebrow + heading + subtitle" block used to introduce
 * each homepage section.
 */
export default function SectionHeading({ eyebrow, title, subtitle, align = "left" }) {
  const alignment = align === "center" ? "items-center text-center mx-auto" : "items-start text-left";

  return (
    <div className={`flex max-w-2xl flex-col gap-3 ${alignment}`}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{eyebrow}</span>
      )}
      <h2 className="font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-base text-slate-600">{subtitle}</p>}
    </div>
  );
}
