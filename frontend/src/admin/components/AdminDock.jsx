import { useState } from "react";
import { Icon } from "../../components/ui/icons.jsx";

/**
 * The admin's floating card in the bottom-left corner (Edit / Add / Highlight ON-OFF ...). It starts folded - just a small
 * arrow pointing up - so it does not cover the post; the arrow opens it (arrow then points down) and closes it again.
 * The children are the card's existing controls, rendered exactly as before when it is open.
 */
export default function AdminDock({ children, zClass = "z-[60]", extra = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <div dir="ltr" className={`fixed bottom-4 left-4 ${zClass} max-w-[calc(100vw-2rem)] rounded-xl border border-rule bg-paper text-ink shadow-elev ${extra}`}>
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Admin card band karein" : "Admin card kholein"} title={open ? "Band karein" : "Kholein"}
        className={`grid place-items-center text-mute hover:text-ink ${open ? "h-7 w-full" : "h-10 w-12"}`}
      >
        <Icon name={open ? "down" : "up"} size={18} />
      </button>
      {open && <div className="flex flex-col gap-1 px-3 pb-2 text-xs">{children}</div>}
    </div>
  );
}
