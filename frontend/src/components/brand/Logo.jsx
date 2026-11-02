import { BRAND } from "../../config/env.js";

/**
 * Official AthariTV logo (gold arch, Arabic calligraphy, pen and book). The artwork is made for a BLACK background, so it always sits on a
 * black rounded tile - in Light and Dark mode alike - and needs no light / dark variants.
 *   variant "emblem"  arch + calligraphy only (small spaces: the admin menu)
 *   variant "lockup"  emblem + ATHARI TV (the navbar)
 *   variant "full"    emblem + ATHARI TV + tagline (footer, sign-in pages)
 * The previous logo files (/logo.png, /logo-dark.png and the /favicon*.png set) are still in /public, unused: going back = one git revert.
 */
const VARIANTS = {
  emblem: { src: "/brand/athari-emblem.webp", w: 420, h: 363 },
  lockup: { src: "/brand/athari-lockup.webp", w: 620, h: 459 },
  full: { src: "/brand/athari-full.webp", w: 760, h: 563 },
};

export function LogoMark({ size = 44, className = "", variant = "lockup" }) {
  const v = VARIANTS[variant] || VARIANTS.lockup;
  const width = Math.round((size * v.w) / v.h);
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-xl bg-black ${className}`}>
      <img src={v.src} alt={BRAND.name} width={width} height={size} style={{ height: size, width }} className="block" decoding="async" />
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

/** The logo, optionally with the text next to it (the lockup / full logo already contain the name: pass showText={false}). */
export function Logo({ size = 40, showText = true, className = "", variant = "emblem" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} variant={variant} />
      {showText && (
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight"><BrandName /></span>
          <span className="dark-cta block whitespace-nowrap text-[8.5px] font-medium tracking-wide text-bronze sm:text-[10px]">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
