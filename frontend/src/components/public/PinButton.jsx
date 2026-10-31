import { useState } from "react";
import { Icon } from "../ui/icons.jsx";

/** Small round pin toggle, shown to a signed-in admin only. Sits inside a link, so it never lets the click open the folder. */
export function PinButton({ active, onToggle, className = "" }) {
  const [busy, setBusy] = useState(false);
  const label = active ? "Unpin" : "Pin";
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try { await onToggle(); } finally { setBusy(false); }
      }}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition disabled:opacity-50 ${active ? "btn-cta border-transparent" : "border-rule bg-card text-mute hover:text-ink"} ${className}`}
    >
      <Icon name="pin" size={15} />
    </button>
  );
}
