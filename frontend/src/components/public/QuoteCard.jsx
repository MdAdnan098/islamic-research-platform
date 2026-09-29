import { QuoteIcon, ShieldCheckIcon } from "../common/Icons.jsx";

/**
 * Structural placeholder that shows how a verified reference will be
 * displayed once articles exist. No religious text/claims are hard-coded —
 * `excerpt` and `reference` are just illustrative UI copy describing the
 * feature, not actual content.
 */
export default function QuoteCard({
  excerpt = "Every research entry on this platform will be displayed with a fully structured reference — source, author, volume, and page.",
  reference = "Structured reference preview",
  status = "Reviewed format",
}) {
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <QuoteIcon className="h-4 w-4" />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          {status}
        </span>
      </div>

      <p className="mt-5 font-serif text-lg leading-relaxed text-slate-800">{excerpt}</p>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reference</p>
        <p className="mt-1 text-sm text-slate-600">{reference}</p>
      </div>
    </div>
  );
}
