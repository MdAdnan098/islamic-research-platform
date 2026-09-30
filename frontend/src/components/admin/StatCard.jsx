/**
 * Displays a dashboard metric. When `value` is null/undefined (no
 * articles/categories API yet), shows a neutral "Not available yet"
 * state instead of inventing a number.
 */
export default function StatCard({ icon, label, value }) {
  const hasValue = typeof value === "number";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {hasValue ? (
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{value}</p>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-slate-400">Not available yet</p>
        )}
      </div>
    </div>
  );
}
