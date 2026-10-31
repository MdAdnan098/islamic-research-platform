import { useEffect, useState } from "react";
import { SLIDER_MAX, SLIDER_STOPS, WIDE_QUERY, headingPercents, nearestStop, stopPos, valuePos } from "../../lib/sizeSlider.js";

/** true on screens >= 640px (Tailwind `sm`), where headings are a little larger relative to body text. */
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY);
    if (!mq) return undefined;
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * Text-size slider: a horizontal line with a round handle. 100% (normal) is the exact centre; left = smaller, right = bigger.
 * Labels above the line show every stop; H3 / H2 sit above the position of their real size (lib/sizeSlider.js HEADING_PERCENT).
 * While dragging only the preview moves; the size is applied once, when the handle is released (one save, not dozens).
 */
export default function SizeSlider({ value, mixed, disabled, onCommit }) {
  const wide = useWide();
  const [drag, setDrag] = useState(null);
  const shown = drag ?? value;
  const hp = headingPercents(wide);

  const finish = () => {
    if (drag === null) return;
    const v = drag;
    setDrag(null);
    if (v !== value || mixed) onCommit(v);
  };
  const onKeyDown = (e) => {
    const i = SLIDER_STOPS.indexOf(shown);
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (step === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? SLIDER_STOPS.length - 1 : Math.min(SLIDER_STOPS.length - 1, Math.max(0, i + step));
    if (SLIDER_STOPS[next] !== value) onCommit(SLIDER_STOPS[next]);
  };
  const at = (percent) => ({ left: `${valuePos(percent) / 10}%` });

  return (
    <div className="w-[min(22rem,86vw)] px-1" dir="ltr">
      <div className="mb-0.5 flex items-baseline justify-between text-[11px] leading-none">
        <span className="text-mute">Text size</span>
        <span aria-live="polite" className="font-semibold tabular-nums" title={mixed ? "Alag-alag size hain; pehle shabd ka size dikh raha hai" : "Selected text ka size"}>{shown}%{mixed && drag === null ? " *" : ""}</span>
      </div>
      {/* labels are inset by the handle's radius (9px) so they line up with the handle centre */}
      <div className="relative mx-[9px] h-3.5" aria-hidden="true">
        <span className="absolute top-0 -translate-x-1/2 text-[10px] font-bold leading-none text-accent" style={at(hp.h3)}>H3</span>
        <span className="absolute top-0 -translate-x-1/2 text-[10px] font-bold leading-none text-accent" style={at(hp.h2)}>H2</span>
      </div>
      <div className="relative mx-[9px] h-3" aria-hidden="true">
        {SLIDER_STOPS.map((s, i) => (
          <span key={s} className={`absolute top-0 -translate-x-1/2 whitespace-nowrap text-[8px] leading-none tabular-nums ${s === shown ? "font-bold text-ink" : "text-mute"}`} style={{ left: `${stopPos(i) / 10}%` }}>{s}%</span>
        ))}
      </div>
      <input
        type="range" className="size-slider" min={0} max={SLIDER_MAX} step={1} disabled={disabled}
        value={valuePos(shown)}
        aria-label="Text size" aria-valuemin={SLIDER_STOPS[0]} aria-valuemax={SLIDER_STOPS[SLIDER_STOPS.length - 1]} aria-valuenow={shown} aria-valuetext={`${shown}%`}
        onChange={(e) => setDrag(nearestStop(Number(e.target.value)))}
        onPointerUp={finish} onTouchEnd={finish} onBlur={finish} onKeyDown={onKeyDown}
      />
    </div>
  );
}
