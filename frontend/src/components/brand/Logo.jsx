import { BRAND } from "../../config/env.js";

/**
 * Official logo image. Normally the light/dark variants swap with the theme. With `badge` the logo always sits on a
 * white rounded tile in BOTH themes, so the dark-ink logo is used on it (the light-ink one would vanish on white).
 */
export function LogoMark({ size = 44, className = "", badge = false }) {
  const style = { height: size, width: "auto" };
  if (badge) {
    return (
      <span className={`inline-flex shrink-0 rounded-xl bg-white p-1 ${className}`}>
        <img src="/logo.png" alt={BRAND.name} style={style} className="block" />
      </span>
    );
  }
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

/** badge: the logo sits on a white rounded tile in Light AND Dark mode. */
export function Logo({ size = 40, showText = true, className = "", badge = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} badge={badge} />
      {showText && (
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight"><BrandName /></span>
          <span className="dark-cta block whitespace-nowrap text-[8.5px] font-medium tracking-wide text-bronze sm:text-[10px]">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
