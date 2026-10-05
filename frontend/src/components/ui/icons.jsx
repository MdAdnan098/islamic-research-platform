const P = {
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-4.5-4.5M11 8v6m-3-3h6",
  zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-4.5-4.5M8 11h6",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  copy: "M9 9h11v11H9zM5 15V4h11",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  check: "M5 12l5 5 9-10",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  download: "M12 4v11m-5-4 5 5 5-5M5 20h14",
  external: "M14 4h6v6m0-6-9 9M18 14v6H4V6h6",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01",
  upload: "M12 16V5m-5 4 5-5 5 5M5 20h14",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  logout: "M10 4H5v16h5m4-4 4-4-4-4m4 4H9",
  book: "M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1zM20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  folder: "M3 6h6l2 2h10v11H3z",
  doc: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  tag: "M3 12V4h8l10 10-8 8z",
  sunrise: "M4 18h16M7 18a5 5 0 0 1 10 0M12 6v3M5.6 10.6l1.6 1.6M18.4 10.6l-1.6 1.6M2 14h2m16 0h2",
  monitor: "M3 5h18v11H3zM9 20h6M12 16v4",
  chevUpDown: "M8 9l4-4 4 4M8 15l4 4 4-4",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  bookmark: "M6 4h12v17l-6-4-6 4z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
};

export function Icon({ name, size = 20, className = "", ...rest }) {
  if (name === "youtube")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" {...rest}>
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />
      </svg>
    );
  if (name === "instagram")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...rest}>
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
