import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/icons.jsx";

/**
 * The admin's floating card in the bottom-left corner (Edit / Add / Highlight ON-OFF ...).
 * Every time a post is opened (resetKey changes) the card shows itself for 3 seconds so the admin knows it is there,
 * then folds into a small arrow by itself and stays folded until the admin opens it by hand.
 * Touching the card while it is open cancels the auto-fold (the admin is using it).
 * The children are the card's existing controls, rendered exactly as before when it is open.
 */
export default function AdminDock({ children, zClass = "z-[60]", extra = "", resetKey = "" }) {
  const [open, setOpen] = useState(true);
  const byHand = useRef(false);
  const timer = useRef(null);
  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => {
    byHand.current = false;
    setOpen(true);
    stop();
    timer.current = setTimeout(() => { if (!byHand.current) setOpen(false); }, 3000);
    return stop;
  }, [resetKey]);

  const toggle = () => { byHand.current = true; stop(); setOpen((v) => !v); };
  const touched = () => { byHand.current = true; stop(); };

  return (
    <div dir="ltr" className={`fixed bottom-4 left-4 ${zClass} max-w-[calc(100vw-2rem)] rounded-xl border border-rule bg-paper text-ink shadow-elev ${extra}`}>
      <button
        type="button" aria-expanded={open} onClick={toggle}
        aria-label={open ? "Admin card band karein" : "Admin card kholein"} title={open ? "Band karein" : "Kholein"}
        className={`grid place-items-center text-mute hover:text-ink ${open ? "h-7 w-full" : "h-10 w-12"}`}
      >
        <Icon name={open ? "down" : "up"} size={18} />
      </button>
      {open && <div onPointerDownCapture={touched} className="flex flex-col gap-1 px-3 pb-2 text-xs">{children}</div>}
    </div>
  );
}
