/**
 * Minimal hand-written SVG icons, kept in one place so we don't add an
 * icon library dependency for a handful of simple glyphs. Each icon
 * accepts a `className` for sizing/color via Tailwind.
 */

export function MenuIcon({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

export function CloseIcon({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function GlobeIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path strokeLinecap="round" d="M3.75 12h16.5M12 3.75c2.25 2.4 3.4 5.2 3.4 8.25s-1.15 5.85-3.4 8.25c-2.25-2.4-3.4-5.2-3.4-8.25S9.75 6.15 12 3.75Z" />
    </svg>
  );
}

export function BookOpenIcon({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5c-1.6-1.2-3.7-1.75-5.75-1.75-.7 0-1.4.06-2 .2v13.3c.6-.14 1.3-.2 2-.2 2.05 0 4.15.55 5.75 1.75m0-13.3c1.6-1.2 3.7-1.75 5.75-1.75.7 0 1.4.06 2 .2v13.3c-.6-.14-1.3-.2-2-.2-2.05 0-4.15.55-5.75 1.75m0-13.3v13.3" />
    </svg>
  );
}

export function ScaleIcon({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M7 21h10M5 7l-2.5 5a2.5 2.5 0 0 0 5 0L5 7Zm14 0-2.5 5a2.5 2.5 0 0 0 5 0L19 7ZM5 7h14M12 3l-3 3M12 3l3 3" />
    </svg>
  );
}

export function LibraryIcon({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5V6.75A2.25 2.25 0 0 1 6.25 4.5H9v15M9 19.5H4m5 0h11m-7-15v15m0-15h3.75A2.25 2.25 0 0 1 18 6.75V19.5m-6-15L9 6l3-1.5Z" />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path strokeLinecap="round" d="m20 20-4.5-4.5" />
    </svg>
  );
}

export function QuoteIcon({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7.17 6A4.17 4.17 0 0 0 3 10.17V18h7V10.17A4.17 4.17 0 0 0 7.17 6Zm10 0A4.17 4.17 0 0 0 13 10.17V18h7V10.17A4.17 4.17 0 0 0 17.17 6Z" />
    </svg>
  );
}

export function ShieldCheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 5 6v5.5c0 4.4 2.98 8.06 7 9 4.02-.94 7-4.6 7-9V6l-7-2.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.25 12 1.9 1.9 3.6-3.9" />
    </svg>
  );
}

export function SpinnerIcon({ className = "w-5 h-5 animate-spin" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} className="opacity-25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

export function LayoutDashboardIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.2" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function LogoutIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17.25 20.25 12 15 6.75M20.25 12h-11" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 20.25H5.25A1.5 1.5 0 0 1 3.75 18.75V5.25A1.5 1.5 0 0 1 5.25 3.75h4.5" />
    </svg>
  );
}

export function FileTextIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7l3.25 3.25v13.25H7V3.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.75V7h3.25M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

export function TagIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5h5.25a1.5 1.5 0 0 1 1.5 1.5v5.25a1.5 1.5 0 0 1-.44 1.06l-7.5 7.5a1.5 1.5 0 0 1-2.12 0l-5.25-5.25a1.5 1.5 0 0 1 0-2.12l7.5-7.5a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="14.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FolderIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.5A1.25 1.25 0 0 1 5 5.25h4l1.75 2h8.5A1.25 1.25 0 0 1 20.5 8.5v9.25a1.25 1.25 0 0 1-1.25 1.25H5a1.25 1.25 0 0 1-1.25-1.25V6.5Z" />
    </svg>
  );
}

export function LinkIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 15 9m-5.25-2.5 1.2-1.2a3.5 3.5 0 1 1 4.95 4.95l-1.2 1.2m-4.4 4.4-1.2 1.2a3.5 3.5 0 1 1-4.95-4.95l1.2-1.2" />
    </svg>
  );
}

export function ImageIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.35" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 17 4.5-4.5 3 3 2.5-2.5 4 4" />
    </svg>
  );
}

export function SettingsIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
