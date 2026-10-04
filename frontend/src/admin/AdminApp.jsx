import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import { ToastProvider } from "./components/ui.jsx";
import { AdminLayout } from "./AdminLayout.jsx";
import Login from "./pages/Login.jsx";
import AdminAccess from "./pages/AdminAccess.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Articles from "./pages/Articles.jsx";
import ArticleEditor from "./pages/ArticleEditor.jsx";
import Categories from "./pages/Categories.jsx";
import Topics from "./pages/Topics.jsx";
import References from "./pages/References.jsx";
import Preview from "./pages/Preview.jsx";

function Protected() {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === "loading") return <div className="p-10 text-center text-sm text-mute">Checking session…</div>;
  if (status === "anon") return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<AdminAccess mode="register" />} />
          <Route path="forgot-password" element={<AdminAccess mode="reset" />} />
          <Route element={<Protected />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="articles" element={<Articles />} />
              <Route path="articles/new" element={<ArticleEditor />} />
              <Route path="articles/:id" element={<ArticleEditor />} />
              <Route path="categories" element={<Categories />} />
              <Route path="topics" element={<Topics />} />
              <Route path="references" element={<References />} />
            </Route>
            <Route path="preview/:id" element={<Preview />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
