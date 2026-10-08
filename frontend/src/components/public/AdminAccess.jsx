import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

/**
 * Hidden shortcut to the EXISTING admin login page (/admin/login). It authenticates nobody: the normal
 * username + password sign-in (JWT, rate limiting …) is still required after it.
 *   - Phones: five quick touch taps on the empty space of the footer's bottom bar (<AdminTapZone/>).
 *   - Desktop: Ctrl+Shift+A (Windows/Linux) or Cmd+Shift+A (macOS); the five-tap does nothing there.
 * Both only ask for confirmation through <AdminAccessDialog/>. No visible "Admin" text or button exists.
 */
const OPEN_EVENT = "fs:admin-access";
const ADMIN_LOGIN_PATH = "/admin/login";
const TAPS_NEEDED = 5;
const WINDOW_MS = 3000;
const MOVE_TOLERANCE_PX = 10; // more movement than this is a scroll / swipe, not a tap
const requestAdminAccess = () => window.dispatchEvent(new Event(OPEN_EVENT));

/**
 * The footer's bottom bar (copyright row) turned into the tap area. Only taps that land on the bar ITSELF count —
 * its empty padding and the blank space beside / between the text lines. A tap whose target is the text, a link,
 * the logo, a button or any other child is not accepted and resets the sequence. Phone-sized layouts + touch only.
 */
export function AdminTapZone({ className = "", children }) {
  const zone = useRef(null);
  const taps = useRef({ count: 0, first: 0, down: null });
  const reset = () => { taps.current.count = 0; taps.current.first = 0; taps.current.down = null; };

  useEffect(() => {
    // Any touch that starts anywhere else (text, links, buttons, content…) breaks the sequence.
    const outside = (e) => { if (e.pointerType === "touch" && e.target !== zone.current) { taps.current.count = 0; taps.current.first = 0; taps.current.down = null; } };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, []);

  const accepts = (e) => e.pointerType === "touch" && e.target === e.currentTarget && window.matchMedia("(max-width: 767px)").matches;
  const onDown = (e) => { if (accepts(e)) taps.current.down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const t = taps.current;
    if (!accepts(e) || !t.down) return;
    const moved = Math.hypot(e.clientX - t.down.x, e.clientY - t.down.y) > MOVE_TOLERANCE_PX; // a scroll / swipe, not a tap
    t.down = null;
    if (moved) { t.count = 0; t.first = 0; return; }
    const now = Date.now();
    if (t.count === 0 || now - t.first > WINDOW_MS) { t.count = 1; t.first = now; return; } // window expired: start over
    t.count += 1;
    if (t.count >= TAPS_NEEDED) { reset(); requestAdminAccess(); }
  };

  return (
    <div
      ref={zone}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={reset}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      className={className}
    >
      {children}
    </div>
  );
}

const isEditable = (el) => {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = el.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox" || !!el.closest?.("[contenteditable]:not([contenteditable='false'])");
};
const isMac = () => /^Mac/i.test(navigator.platform || "");

/** Mounted once in the public layout: listens for the tap-zone event and the desktop shortcut, shows the confirmation. */
export function AdminAccessDialog() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const continueBtn = useRef(null);
  const openedAt = useRef(0);
  // The "click" that follows the fifth tap's pointerup lands on the freshly opened dialog: ignore clicks for a moment.
  const settled = () => Date.now() - openedAt.current > 400;

  useEffect(() => {
    const show = () => { openedAt.current = Date.now(); setOpen(true); };
    const onKey = (e) => {
      if (e.repeat || e.altKey || !e.shiftKey) return;
      const mod = isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (!mod || (e.code !== "KeyA" && String(e.key).toLowerCase() !== "a")) return;
      if (isEditable(e.target) || isEditable(document.activeElement)) return; // never while typing
      e.preventDefault();
      openedAt.current = Date.now();
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    continueBtn.current?.focus();
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Admin Access" dir="ltr" className="animate-fade w-full max-w-xs rounded-2xl border border-rule bg-paper p-5 text-ink shadow-elev">
        <p className="text-center text-lg font-bold">Admin Access खोलें?</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" className="btn-outline !px-4 !py-2" onClick={() => { if (settled()) setOpen(false); }}>Cancel</button>
          <button ref={continueBtn} type="button" className="btn-primary !px-4 !py-2" onClick={() => { if (!settled()) return; setOpen(false); nav(ADMIN_LOGIN_PATH); }}>Continue</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
