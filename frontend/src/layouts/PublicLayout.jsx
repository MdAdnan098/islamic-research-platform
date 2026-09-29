import { Outlet } from "react-router-dom";
import Header from "../components/public/Header.jsx";
import Footer from "../components/public/Footer.jsx";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <Header />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
