import { useAuth } from "../../context/AuthContext.jsx";
import StatCard from "../../components/admin/StatCard.jsx";
import { FileTextIcon, ShieldCheckIcon, FolderIcon, TagIcon } from "../../components/common/Icons.jsx";

/**
 * Dashboard foundation only. Stats are intentionally not wired to real
 * numbers yet — there is no articles/categories API in this phase — so
 * StatCard shows a neutral "Not available yet" state instead of a fake
 * count.
 */
export default function Dashboard() {
  const { adminUser } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-xl font-semibold text-slate-900">
          Welcome{adminUser?.email ? `, ${adminUser.email}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          This is the admin panel foundation. Content management tools will
          appear here as each module is built.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FileTextIcon />} label="Articles" value={null} />
        <StatCard icon={<ShieldCheckIcon />} label="Published" value={null} />
        <StatCard icon={<FolderIcon />} label="Drafts" value={null} />
        <StatCard icon={<TagIcon />} label="Categories" value={null} />
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Articles, Categories, Topics, References, and Media management
          will be added in upcoming phases.
        </p>
      </div>
    </div>
  );
}
