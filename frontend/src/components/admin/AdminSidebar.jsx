import { NavLink } from "react-router-dom";
import { ADMIN_NAV_LINKS } from "../../utils/navigation.js";
import {
  LayoutDashboardIcon,
  FileTextIcon,
  TagIcon,
  FolderIcon,
  LinkIcon,
  ImageIcon,
  SettingsIcon,
} from "../common/Icons.jsx";

const ICONS = {
  dashboard: LayoutDashboardIcon,
  articles: FileTextIcon,
  categories: TagIcon,
  topics: FolderIcon,
  references: LinkIcon,
  media: ImageIcon,
  settings: SettingsIcon,
};

/**
 * @param {{ onNavigate?: () => void }} props - onNavigate closes the
 *   mobile drawer after a link is tapped.
 */
export default function AdminSidebar({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {ADMIN_NAV_LINKS.map((link) => {
        const Icon = ICONS[link.key] || LayoutDashboardIcon;

        if (!link.enabled) {
          return (
            <span
              key={link.key}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400"
            >
              <Icon className="h-5 w-5" />
              {link.label}
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Soon
              </span>
            </span>
          );
        }

        return (
          <NavLink
            key={link.key}
            to={link.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
