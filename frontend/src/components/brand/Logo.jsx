import { BRAND } from "../../config/env.js";

/**
 * Official AthariTV logo, the WHOLE image as supplied (nothing cropped): gold arch, calligraphy, pen, book, ATHARI TV and tagline on black.
 * It is made for a black background, so it always sits on a black rounded tile (Light and Dark mode alike). `size` is the height of the
 * image, as before; with `badge` the tile gets a little padding around it (navbar, footer, admin menu).
 * The previous logo files (/logo.png, /logo-dark.png and the /favicon*.png set) are still in /public, unused: going back = one git revert.
 */
const SRC = "/brand/athari-logo.webp";
const RATIO = 540 / 464; // width / height of the image

export function LogoMark({ size = 44, className = "", badge = false }) {
  const width = Math.round(size * RATIO);
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-xl bg-black ${badge ? "p-1" : ""} ${className}`}>
      <img src={SRC} alt={BRAND.name} width={width} height={size} style={{ height: size, width }} className="block" decoding="async" />
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

/** badge: the logo sits on a black rounded tile with a little padding, in Light AND Dark mode. */
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
