import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/public/Navbar.jsx";
import { Footer } from "../components/public/Footer.jsx";

export function PublicLayout({ children }) {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1">{children ?? <Outlet />}</main>
      <Footer />
    </div>
  );
}
