import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/ui/icons.jsx";

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random();
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 end-4 z-[200] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`animate-fade rounded-lg border px-3.5 py-2.5 text-sm shadow-soft ${t.type === "error" ? "border-ad-danger/40 bg-ad-card text-ad-danger" : "border-ad-rule bg-ad-card text-ad-ink"}`}>{t.message}</div>
        ))}
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
  draft: "bg-ad-warn/12 text-ad-warn", archived: "bg-ad-mute/15 text-ad-mute",
};
export function StatusBadge({ status }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONES[status] || TONES.archived}`}>{status}</span>;
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
