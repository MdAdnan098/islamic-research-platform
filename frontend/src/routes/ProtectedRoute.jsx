import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SpinnerIcon } from "../components/common/Icons.jsx";

/**
 * Gate for any admin route tree. Renders nothing (protected content)
 * until the initial session check has resolved, so a dashboard never
 * flashes before authentication is confirmed.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isCheckingSession } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <SpinnerIcon className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
