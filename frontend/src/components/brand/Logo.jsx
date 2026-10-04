import { BRAND } from "../../config/env.js";

/** Official logo image — light/dark variants swap automatically with the theme. */
export function LogoMark({ size = 44, className = "" }) {
  const style = { height: size, width: "auto" };
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <img src="/logo.png" alt={BRAND.name} style={style} className="block dark:hidden" />
      <img src="/logo-dark.png" alt={BRAND.name} style={style} className="hidden dark:block" />
    </span>
  );
}

export function Logo({ size = 40, showText = true, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showText && (
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight">{BRAND.name}</span>
          <span className="block whitespace-nowrap text-[8.5px] font-medium tracking-wide text-bronze sm:text-[10px]">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
