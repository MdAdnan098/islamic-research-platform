import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <header className="border-b p-4">
        <h1 className="text-lg font-semibold">Islamic Research Platform</h1>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <footer className="border-t p-4 text-sm text-gray-500">
        Public research portal
      </footer>
    </div>
  );
}
