/**
 * The divider between parts of a post: a hair-thin line that is finest at both ends and slightly fuller in the middle,
 * full width with a small gap at each side, and a soft shadow only under the middle of it.
 */
export function Divider({ className = "my-10" }) {
  return (
    <div className={`relative mx-3 h-[10px] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 3" preserveAspectRatio="none" fill="currentColor" className="absolute inset-x-0 top-0 block h-[3px] w-full text-mute opacity-70">
        <path d="M0 1.5Q50 0.6 100 1.5Q50 2.4 0 1.5Z" />
      </svg>
      <span
        className="absolute left-1/2 top-[2px] h-[8px] w-[42%] -translate-x-1/2 text-ink opacity-25"
        style={{ background: "radial-gradient(ellipse at 50% 0%, currentColor 0%, transparent 72%)", filter: "blur(1.5px)" }}
      />
    </div>
  );
}
