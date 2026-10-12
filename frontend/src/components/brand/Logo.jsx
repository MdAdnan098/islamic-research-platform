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

/** Wordmark: "Athari" is the main text, "TV" stays smaller and subtle. */
export function BrandName({ className = "" }) {
  return (
    <span className={className}>
      Athari<span className="ms-px text-[0.62em] font-semibold tracking-wide opacity-70">TV</span>
    </span>
  );
}

/** badge: in Light mode the logo sits on a white rounded tile (so it stays clear on the teal navbar / footer). */
export function Logo({ size = 40, showText = true, className = "", badge = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} className={badge ? "rounded-xl bg-white p-1 dark:bg-transparent dark:p-0" : ""} />
      {showText && (
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight"><BrandName /></span>
          <span className="block whitespace-nowrap text-[8.5px] font-medium tracking-wide text-bronze sm:text-[10px]">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
