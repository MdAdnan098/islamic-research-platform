import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useIsAdmin } from "../../lib/adminHint.js";

/**
 * Admin-only drag-and-drop ordering for any list / grid of cards on the public site.
 *
 *   <Sortable items={posts} className="grid ..." itemClassName="h-full min-w-0" onReorder={(ids, items) => api(ids)}>
 *     {(post) => <ArticleCard article={post} />}
 *   </Sortable>
 *
 * - A visitor (or anyone not signed in as admin) gets the plain list: no wrappers, no listeners, nothing changes.
 * - For a signed-in admin: press and HOLD a card (~0.45 s; finger on a phone, left mouse button on a laptop), then slide it
 *   anywhere (up / down / left / right). The other cards make room, and on release the new order is saved with NO
 *   confirmation. A normal tap or click still opens the card; scrolling with a finger still scrolls (moving before the hold ends cancels it).
 * - onReorder(ids, items) must save the order on the server (it may return a promise); if it throws, the old order comes back.
 *
 * The DOM is never re-ordered while dragging (cards only move with CSS transforms), so touch / pointer events stay attached.
 */
const HOLD_MS = 450;
const MOVE_TOL = 9;
const EDGE = 70;
const MAX_SCROLL = 18;
const INTERACTIVE = "button, input, select, textarea, label, [data-no-drag]";

export function Sortable({ items, getId = (x) => x.id, onReorder, as: Tag = "div", className, itemClassName = "", style, children }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin || !onReorder) {
    return <Tag className={className} style={style}>{items.map((item) => <Fragment key={getId(item)}>{children(item)}</Fragment>)}</Tag>;
  }
  return <AdminSortable {...{ items, getId, onReorder, Tag, className, itemClassName, style }}>{children}</AdminSortable>;
}

const scrollSum = (el) => {
  let x = 0, y = 0;
  for (let n = el; n; n = n.parentElement) { x += n.scrollLeft || 0; y += n.scrollTop || 0; }
  return { x, y };
};

const scrollParents = (el) => {
  const out = [];
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) out.push(n);
  }
  return out;
};

const speed = (d) => Math.max(2, Math.min(MAX_SCROLL, Math.ceil((d / EDGE) * MAX_SCROLL)));

export function AdminSortable({ items, getId, onReorder, Tag, className, itemClassName, style, children }) {
  const propIds = items.map(getId);
  const sig = propIds.join("|");
  const [state, setState] = useState({ sig, ids: propIds });
  if (state.sig !== sig) setState({ sig, ids: propIds }); // the list changed from outside (reload / other page): follow it
  const shown = useMemo(() => {
    const byId = new Map(items.map((i) => [getId(i), i]));
    const ordered = state.ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
    const seen = new Set(state.ids);
    return [...ordered, ...items.filter((i) => !seen.has(getId(i)))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, state.ids]);

  const box = useRef(null);
  const els = useRef(new Map());
  const live = useRef({ shown, items, onReorder, getId });
  live.current = { shown, items, onReorder, getId };
  const drag = useRef(null);
  const swallow = useRef(0);

  // A finger move must be cancellable to stop the page scrolling while a card is being dragged: the listener has to be
  // registered as non-passive from the start (adding it after the touch began is too late in Chrome).
  useEffect(() => {
    const node = box.current;
    const stop = (e) => { if (drag.current?.active && e.cancelable) e.preventDefault(); };
    node?.addEventListener("touchmove", stop, { passive: false });
    return () => node?.removeEventListener("touchmove", stop);
  }, []);
  useEffect(() => () => drag.current?.cleanup?.(), []);

  const begin = (e) => {
    if (drag.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const wrap = e.target.closest?.("[data-sort-id]");
    if (!wrap || !box.current?.contains(wrap) || e.target.closest(INTERACTIVE)) return;
    const d = { id: wrap.dataset.sortId, px: e.clientX, py: e.clientY, x0: e.clientX, y0: e.clientY, active: false, raf: 0, timer: 0 };
    drag.current = d;

    const ids = () => live.current.shown.map((i) => live.current.getId(i));

    const frame = () => {
      if (!d.active) return;
      autoScroll();
      update();
      d.raf = requestAnimationFrame(frame);
    };

    const autoScroll = () => {
      const { px, py } = d;
      for (const s of scrollParents(box.current)) {
        const r = s.getBoundingClientRect();
        if (px < r.left || px > r.right || py < r.top - EDGE || py > r.bottom + EDGE) continue;
        if (py < r.top + EDGE) { s.scrollTop -= speed(r.top + EDGE - py); return; }
        if (py > r.bottom - EDGE) { s.scrollTop += speed(py - (r.bottom - EDGE)); return; }
      }
      if (py < EDGE) window.scrollBy(0, -speed(EDGE - py));
      else if (py > window.innerHeight - EDGE) window.scrollBy(0, speed(py - (window.innerHeight - EDGE)));
    };

    const update = () => {
      const s = scrollSum(box.current);
      const dx = s.x - d.scroll0.x, dy = s.y - d.scroll0.y;
      const nat = d.nat0.map((r) => ({ l: r.l - dx, t: r.t - dy, w: r.w, h: r.h }));
      const from = d.ids.indexOf(d.id);
      const want = { l: d.px - d.gx, t: d.py - d.gy };
      const cx = want.l + nat[from].w / 2, cy = want.t + nat[from].h / 2;
      let to = from, best = Infinity;
      nat.forEach((r, k) => {
        const dist = (cx - (r.l + r.w / 2)) ** 2 + (cy - (r.t + r.h / 2)) ** 2;
        if (dist < best) { best = dist; to = k; }
      });
      const order = d.ids.filter((id) => id !== d.id);
      order.splice(to, 0, d.id);
      d.order = order;
      order.forEach((id, k) => {
        const el = els.current.get(id);
        if (!el) return;
        const own = nat[d.ids.indexOf(id)];
        const tx = id === d.id ? want.l - own.l : nat[k].l - own.l;
        const ty = id === d.id ? want.t - own.t : nat[k].t - own.t;
        el.style.transform = tx || ty ? `translate3d(${tx}px, ${ty}px, 0)` : "";
      });
    };

    const activate = () => {
      d.ids = ids();
      d.order = d.ids;
      d.scroll0 = scrollSum(box.current);
      d.nat0 = d.ids.map((id) => { const r = els.current.get(id).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
      const from = d.ids.indexOf(d.id);
      if (from < 0) { d.cleanup(); return; }
      d.gx = d.px - d.nat0[from].l;
      d.gy = d.py - d.nat0[from].t;
      d.active = true;
      swallow.current = Date.now() + 60_000; // the release must not count as a tap on the card
      for (const id of d.ids) {
        const el = els.current.get(id);
        if (!el) continue;
        if (id === d.id) Object.assign(el.style, { position: "relative", zIndex: "60", transition: "none", cursor: "grabbing", opacity: "0.96", boxShadow: "0 0 0 2px rgb(var(--cta)), 0 14px 32px rgba(0,0,0,.38)" });
        else Object.assign(el.style, { transition: "transform 180ms ease", willChange: "transform" });
      }
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
      d.raf = requestAnimationFrame(frame);
    };

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      d.px = ev.clientX; d.py = ev.clientY;
      if (!d.active && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > MOVE_TOL) d.cleanup(); // it was a scroll / a swipe, not a hold
    };
    const onUp = (ev) => { if (ev.pointerId === e.pointerId) finish(true); };
    const onCancel = (ev) => { if (ev.pointerId === e.pointerId) finish(false); };
    const onKey = (ev) => { if (ev.key === "Escape") finish(false); };

    d.cleanup = () => {
      clearTimeout(d.timer);
      cancelAnimationFrame(d.raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      for (const el of els.current.values()) {
        if (!el) continue;
        for (const k of ["transform", "transition", "willChange", "position", "zIndex", "cursor", "opacity", "boxShadow"]) el.style[k] = "";
      }
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      if (drag.current === d) drag.current = null;
    };

    const finish = (commit) => {
      const wasActive = d.active;
      const before = d.ids;
      const after = d.order;
      d.active = false;
      if (wasActive) swallow.current = Date.now() + 350;
      const changed = wasActive && commit && after && after.join("|") !== before.join("|");
      if (!changed) { d.cleanup(); return; }
      const byId = new Map(live.current.shown.map((i) => [live.current.getId(i), i]));
      const nextItems = after.map((id) => byId.get(id)).filter(Boolean);
      const prev = before;
      // new order and cleared transforms land in the same frame, so the cards do not jump
      flushSync(() => setState({ sig: live.current.items.map(live.current.getId).join("|"), ids: after }));
      d.cleanup();
      Promise.resolve()
        .then(() => live.current.onReorder(after, nextItems))
        .catch((err) => {
          setState((s) => ({ ...s, ids: prev }));
          window.alert(err?.message || "Sequence save nahi ho saka. Dobara koshish karein.");
        });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    d.timer = setTimeout(activate, HOLD_MS);
  };

  return (
    <Tag
      ref={box}
      className={className}
      style={style}
      onPointerDown={begin}
      onClickCapture={(e) => { if (Date.now() < swallow.current) { e.preventDefault(); e.stopPropagation(); } }}
      onContextMenu={(e) => { if (e.target.closest?.("[data-sort-id]")) e.preventDefault(); }}
      onDragStart={(e) => e.preventDefault()}
    >
      {shown.map((item) => {
        const id = getId(item);
        return (
          <div key={id} data-sort-id={id} ref={(el) => (el ? els.current.set(id, el) : els.current.delete(id))} className={`select-none [-webkit-touch-callout:none] [-webkit-user-drag:none] ${itemClassName}`}>
            {children(item)}
          </div>
        );
      })}
    </Tag>
  );
}
