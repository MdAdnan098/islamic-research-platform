import { useEffect, useRef, useState } from "react";
import { useFontSize } from "../../context/FontSizeContext.jsx";
import { useI18n } from "../../i18n/index.jsx";
import { Icon } from "../ui/icons.jsx";

/** Dismisses a popover on outside click or Escape */
function useDismiss(open, setOpen, box) {
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        box.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, setOpen, box]);
}

/**
 * In-article font size control.
 * Sits in the article header alongside the language selector.
 */
export function FontSizeControl({ className = "" }) {
  const {
    scale,
    percentage,
    isDefault,
    canIncrease,
    canDecrease,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    setFontScale,
    presets,
  } = useFontSize();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useDismiss(open, setOpen, box);

  const articleI18n = t.article || {};

  return (
    <div ref={box} className={`relative inline-flex items-center ${className}`}>
      <div
        role="group"
        aria-label={articleI18n.fontSize || "Font size"}
        className="inline-flex items-center rounded-full border border-rule bg-field p-0.5 shadow-sm transition-colors hover:border-accent/50"
      >
        {/* Decrease button */}
        <button
          type="button"
          onClick={decreaseFontSize}
          disabled={!canDecrease}
          aria-label={articleI18n.makeSmaller || "Decrease font size (A-)"}
          title={articleI18n.makeSmaller || "Decrease font size (A-)"}
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-ink transition hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent"
        >
          A<span className="text-[10px] font-normal leading-none">-</span>
        </button>

        {/* Center badge & dropdown toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${articleI18n.fontSize || "Font size"}: ${percentage}%`}
          title={`${articleI18n.fontSize || "Font size"}: ${percentage}%`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-ink transition hover:bg-tint"
        >
          <span className="text-accent">Aa</span>
          <span className="text-[11px] tabular-nums text-mute">{percentage}%</span>
          <Icon name="down" size={12} className="text-mute/70" />
        </button>

        {/* Increase button */}
        <button
          type="button"
          onClick={increaseFontSize}
          disabled={!canIncrease}
          aria-label={articleI18n.makeLarger || "Increase font size (A+)"}
          title={articleI18n.makeLarger || "Increase font size (A+)"}
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-ink transition hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent"
        >
          A<span className="text-[10px] font-normal leading-none">+</span>
        </button>
      </div>

      {/* Preset dropdown popover */}
      {open && (
        <div
          role="listbox"
          aria-label={articleI18n.fontSize || "Font size presets"}
          className="absolute end-0 top-full z-40 mt-2 w-48 animate-fade overflow-hidden rounded-xl border border-rule bg-card p-1.5 shadow-soft"
        >
          <div className="flex items-center justify-between border-b border-rule px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-ink">{articleI18n.textSize || "Text Size"}</span>
            {!isDefault && (
              <button
                type="button"
                onClick={() => {
                  resetFontSize();
                  setOpen(false);
                }}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                {articleI18n.resetSize || "Reset"}
              </button>
            )}
          </div>
          <div className="py-1">
            {presets.map((p) => {
              const active = Math.abs(scale - p.scale) < 0.04;
              const label = articleI18n[p.labelKey] || p.defaultLabel;
              return (
                <button
                  key={p.scale}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setFontScale(p.scale);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs transition ${
                    active ? "bg-tint font-bold text-accent" : "text-ink hover:bg-tint"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="font-display font-medium text-ink"
                      style={{ fontSize: `${0.85 * p.scale}rem` }}
                    >
                      Aa
                    </span>
                    <span>{label}</span>
                  </span>
                  <span className="tabular-nums text-mute/80">{Math.round(p.scale * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating reader controls that gently appear when scrolling through long articles.
 * Positioned at bottom-end corner (bottom-right in LTR) so it does not collide with admin tools.
 */
export function FloatingReaderControls() {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const {
    percentage,
    canIncrease,
    canDecrease,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    isDefault,
  } = useFontSize();
  const { t } = useI18n();
  const articleI18n = t.article || {};

  useEffect(() => {
    const handleScroll = () => {
      // Reveal floating controls when user scrolls past 300px
      const scrolled = window.scrollY > 300;
      setVisible(scrolled);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label={articleI18n.fontSize || "Reading controls"}
      dir="ltr"
      className="fixed bottom-5 end-4 z-40 transition-all duration-300 ease-out select-none"
    >
      <div className="flex items-center gap-1 rounded-full border border-rule bg-card/95 px-2 py-1.5 shadow-elev backdrop-blur-md">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Open font size controls"
            title={`${articleI18n.fontSize || "Font size"}: ${percentage}%`}
            className="flex h-7 items-center gap-1 px-1.5 text-xs font-bold text-accent hover:opacity-80"
          >
            <span>Aa</span>
            <span className="text-[10px] text-mute">{percentage}%</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={decreaseFontSize}
              disabled={!canDecrease}
              aria-label={articleI18n.makeSmaller || "Decrease font size (A-)"}
              title={articleI18n.makeSmaller || "Decrease font size (A-)"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-ink transition hover:bg-tint disabled:opacity-30"
            >
              A<span className="text-[10px] font-normal leading-none">-</span>
            </button>

            <button
              type="button"
              onClick={resetFontSize}
              aria-label={articleI18n.resetSize || "Reset font size to 100%"}
              title={isDefault ? `${percentage}%` : `${percentage}% — Click to reset`}
              className="flex h-7 items-center rounded-full px-1.5 text-xs font-semibold text-ink transition hover:bg-tint"
            >
              <span className="text-accent">Aa</span>
              <span className="ms-0.5 text-[10px] tabular-nums text-mute">{percentage}%</span>
            </button>

            <button
              type="button"
              onClick={increaseFontSize}
              disabled={!canIncrease}
              aria-label={articleI18n.makeLarger || "Increase font size (A+)"}
              title={articleI18n.makeLarger || "Increase font size (A+)"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-ink transition hover:bg-tint disabled:opacity-30"
            >
              A<span className="text-[10px] font-normal leading-none">+</span>
            </button>

            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse reading controls"
              title="Minimize"
              className="ms-0.5 flex h-5 w-5 items-center justify-center rounded-full text-mute/60 transition hover:bg-tint hover:text-ink"
            >
              <Icon name="x" size={11} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
