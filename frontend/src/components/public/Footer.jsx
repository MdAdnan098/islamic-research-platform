import { NavLink } from "react-router-dom";
import Container from "../common/Container.jsx";

const FOOTER_COLUMNS = [
  {
    title: "Research",
    links: [
      { label: "Aqeedah", href: "/aqeedah" },
      { label: "Masail", href: "/masail" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Admin", href: "/admin/login" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-900 text-slate-300">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-800 font-serif text-base font-bold text-white">
              IR
            </span>
            <span className="font-serif text-lg font-semibold text-white">Islamic Research</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            A structured, source-referenced research platform for Aqeedah and
            Masail, built for accuracy and clarity.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold text-white">{column.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <NavLink to={link.href} className="text-sm text-slate-400 hover:text-emerald-400">
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-white">Languages</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            <li>Roman</li>
            <li>Hindi</li>
            <li>Urdu</li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-slate-800">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-slate-500 sm:flex-row">
          <p>&copy; {year} Islamic Research Platform. All rights reserved.</p>
          <p>Every reference is reviewed before publication.</p>
        </Container>
      </div>
    </footer>
  );
}
