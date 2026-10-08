import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/ui/icons.jsx";

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

/* Popup colours are fixed on purpose (white card, black text, red for errors) - they do not follow the theme. */
const TOAST_CSS = `
@keyframes ad-toast-in { from { transform: translateY(calc(-100% - 60px)); } to { transform: translateY(0); } }
@keyframes ad-toast-out { from { transform: translateY(0); } to { transform: translateY(calc(-100% - 60px)); } }
@keyframes ad-draw { to { stroke-dashoffset: 0; } }
@keyframes ad-fill { to { fill-opacity: 1; } }
.ad-toast { animation: ad-toast-in .38s cubic-bezier(.22,1,.36,1) both; }
.ad-toast[data-leaving="true"] { animation: ad-toast-out .26s ease-in both; }
.ad-ring { stroke-dasharray: 152; stroke-dashoffset: 152; fill-opacity: 0; animation: ad-draw .5s ease-out .15s forwards, ad-fill .2s ease-out .6s forwards; }
.ad-tick { stroke-dasharray: 36; stroke-dashoffset: 36; animation: ad-draw .35s ease-out .6s forwards; }
.ad-x1 { stroke-dasharray: 20; stroke-dashoffset: 20; animation: ad-draw .2s ease-out .6s forwards; }
.ad-x2 { stroke-dasharray: 20; stroke-dashoffset: 20; animation: ad-draw .2s ease-out .78s forwards; }
@media (prefers-reduced-motion: reduce) {
  .ad-toast, .ad-toast[data-leaving="true"] { animation-duration: .01s; }
  .ad-ring, .ad-tick, .ad-x1, .ad-x2 { animation-duration: .01s; animation-delay: 0s; }
}`;

/* The ring is drawn clockwise from the top-right point and stops there; then the tick (or cross) draws in. */
function ToastIcon({ error }) {
  const c = error ? "#dc2626" : "#16a34a";
  return (
    <svg width="28" height="28" viewBox="0 0 52 52" fill="none" aria-hidden="true" className="shrink-0">
      <path className="ad-ring" d="M42.97 9.03 A24 24 0 1 1 9.03 42.97 A24 24 0 1 1 42.97 9.03 Z" stroke={c} strokeWidth="3" fill={c} />
      {error ? (
        <>
          <path className="ad-x1" d="M18 18 L34 34" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <path className="ad-x2" d="M34 18 L18 34" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <path className="ad-tick" d="M15 27 L23 35 L38 18" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const dismiss = useCallback((id) => {
    setItems((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => remove(id), 280);
  }, [remove]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random();
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <style>{TOAST_CSS}</style>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-3"
        style={{ paddingTop: "calc(36px + env(safe-area-inset-top, 0px))" }}
        aria-live="polite"
      >
        {items.map((t) => {
          const error = t.type === "error";
          return (
            <div
              key={t.id}
              role={error ? "alert" : "status"}
              data-leaving={t.leaving ? "true" : "false"}
              onClick={() => dismiss(t.id)}
              className="ad-toast pointer-events-auto flex w-fit max-w-[min(92vw,440px)] cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium"
              style={{ background: "#ffffff", color: error ? "#dc2626" : "#111111", border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 8px 28px rgba(0,0,0,.18)" }}
            >
              <ToastIcon error={error} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, desc, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-ad-mute">{desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ad-mute">{hint}</span>}
    </label>
  );
}

const TONES = {
  published: "bg-ad-ok/12 text-ad-ok", active: "bg-ad-ok/12 text-ad-ok",
  draft: "bg-ad-warn/12 text-ad-warn", unpaid: "bg-ad-warn/12 text-ad-warn", approved: "bg-ad-ok/12 text-ad-ok", rejected: "bg-ad-danger/12 text-ad-danger", archived: "bg-ad-mute/15 text-ad-mute",
  // live sessions / courses / payments / enrollments
  live: "bg-ad-danger/12 text-ad-danger", scheduled: "bg-ad-warn/12 text-ad-warn", ended: "bg-ad-mute/15 text-ad-mute",
  enrollment_open: "bg-ad-ok/12 text-ad-ok", coming_soon: "bg-ad-warn/12 text-ad-warn", enrollment_closed: "bg-ad-mute/15 text-ad-mute", completed: "bg-ad-mute/15 text-ad-mute",
  paid: "bg-ad-ok/12 text-ad-ok", confirmed: "bg-ad-ok/12 text-ad-ok", pending: "bg-ad-warn/12 text-ad-warn", created: "bg-ad-mute/15 text-ad-mute",
  failed: "bg-ad-danger/12 text-ad-danger", cancelled: "bg-ad-danger/12 text-ad-danger", refunded: "bg-ad-mute/15 text-ad-mute",
  // enrolled = paid + automatically enrolled; course lifecycle phases
  enrolled: "bg-ad-ok/12 text-ad-ok", upcoming: "bg-ad-warn/12 text-ad-warn", in_progress: "bg-ad-danger/12 text-ad-danger", unscheduled: "bg-ad-mute/15 text-ad-mute",
};
export function StatusBadge({ status }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONES[status] || TONES.archived}`}>{String(status).replace(/_/g, " ")}</span>;
}

export function Spinner() {
  return <div className="p-10 text-center text-sm text-ad-mute">Loading…</div>;
}
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="a-card p-6 text-center text-sm" role="alert">
      <p className="text-ad-danger">{error?.message || "Something went wrong."}</p>
      {onRetry && <button className="a-btn mt-3" onClick={onRetry}>Retry</button>}
    </div>
  );
}
export function Empty({ children }) {
  return <div className="a-card border-dashed p-10 text-center text-sm text-ad-mute">{children}</div>;
}

/* ---------- Modal + confirm ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} dir="ltr" className={`animate-fade max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-ad-rule bg-ad-card font-ui text-ad-ink shadow-soft sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-ad-rule bg-ad-card px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-ad-mute hover:text-ad-ink" aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => { state?.resolve(v); setState(null); };
  const dialog = state && (
    <Modal title={state.title || "Are you sure?"} onClose={() => close(false)}>
      <p className="text-sm text-ad-mute">{state.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="a-btn" onClick={() => close(false)}>Cancel</button>
        <button className={state.danger ? "a-btn-danger" : "a-btn-primary"} onClick={() => close(true)}>{state.confirm || "Confirm"}</button>
      </div>
    </Modal>
  );
  return [ask, dialog];
}

/* ---------- Reorder helper ---------- */
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
export const toOrdering = (list) => list.map((x, i) => ({ id: x.id, ordering: i }));

export function IconBtn({ icon, label, onClick, disabled, danger }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-md border border-transparent transition hover:border-ad-rule hover:bg-ad-bg disabled:opacity-30 ${danger ? "text-ad-danger" : "text-ad-mute hover:text-ad-ink"}`}>
      <Icon name={icon} size={16} />
    </button>
  );
}
