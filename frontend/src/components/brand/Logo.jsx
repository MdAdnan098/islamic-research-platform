import { BRAND } from "../../config/env.js";

/**
 * Fahm-e-Salaf mark — vector, theme-aware (uses currentColor + --gold).
 * Dome silhouette holding the Arabic wordmark, with an open book and a
 * qalam resting beneath. Pure SVG paths + one <text> (Amiri).
 */
export function LogoMark({ size = 44, className = "" }) {
  return (
    <svg width={size} height={size * 0.93} viewBox="0 0 120 112" className={className} role="img" aria-label={BRAND.name}>
      <g fill="none" stroke="rgb(var(--gold))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {/* dome + finial */}
        <path d="M18 76V62C18 40 36 24 60 24s42 16 42 38v14" />
        <path d="M60 24v-9" /><circle cx="60" cy="11" r="2.4" fill="rgb(var(--gold))" stroke="none" />
        <path d="M12 76h96" />
        {/* open book */}
        <path d="M60 88c-8-4-19-4-28 0v12c9-4 20-4 28 0 8-4 19-4 28 0V88c-9-4-20-4-28 0z" strokeWidth="2.2" />
        <path d="M60 88v12" strokeWidth="2.2" />
        {/* qalam */}
        <path d="M110 84 96 102l-1.5 5 5-2z" strokeWidth="2" />
      </g>
      <text x="60" y="68" textAnchor="middle" fontFamily="Amiri, 'Noto Naskh Arabic', serif" fontWeight="700" fontSize="25" fill="currentColor">
        {BRAND.arabic}
      </text>
    </svg>
  );
}

export function Logo({ size = 40, showText = true, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} className="shrink-0 text-ink" />
      {showText && (
        <span className="leading-tight">
          <span className="block font-display text-lg font-semibold tracking-tight">{BRAND.name}</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-bronze rtl:tracking-normal">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
