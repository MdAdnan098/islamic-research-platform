import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "../../utils/navigation.js";
import { GlobeIcon, ChevronDownIcon } from "../common/Icons.jsx";

/**
 * Presentational language switcher. Selecting a language only updates
 * local UI state for now — real content translation is a later phase
 * (see project roadmap).
 */
export default function LanguageSwitcher({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(LANGUAGES[0]);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
      >
        <GlobeIcon className="h-4 w-4 text-slate-400" />
        <span>{selected.label}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={selected.code === lang.code}
                onClick={() => {
                  setSelected(lang);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-sm ${
                  selected.code === lang.code
                    ? "bg-emerald-50 font-semibold text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {lang.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
