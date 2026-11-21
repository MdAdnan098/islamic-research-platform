/** A thin line with a very light curve and soft shadow in the middle - the divider between parts of a post. */
export function Divider({ className = "my-10" }) {
  return (
    <div className={`flex items-end text-rule ${className}`} aria-hidden="true">
      <span className="mb-px h-px flex-1 bg-current" />
      <svg width="64" height="11" viewBox="0 0 64 11" fill="none" className="shrink-0" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.16))" }}>
        <path d="M0 10.2C14 10.2 20 1 32 1s18 9.2 32 9.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span className="mb-px h-px flex-1 bg-current" />
    </div>
  );
}
