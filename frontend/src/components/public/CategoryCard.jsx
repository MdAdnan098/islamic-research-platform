import { NavLink } from "react-router-dom";
import { ChevronRightIcon } from "../common/Icons.jsx";

/**
 * Generic category card. `count` is left undefined by default rather than
 * hard-coded to zero/any number, since real counts will come from the
 * backend once categories have content.
 */
export default function CategoryCard({ icon, title, description, href, count }) {
  return (
    <NavLink
      to={href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-slate-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
          {icon}
        </span>
        {typeof count === "number" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {count} {count === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
        Browse
        <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </NavLink>
  );
}
