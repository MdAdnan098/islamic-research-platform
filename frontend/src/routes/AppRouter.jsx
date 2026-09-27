import { BrowserRouter, Routes } from "react-router-dom";
import PublicRoutes from "./PublicRoutes.jsx";
import AdminRoutes from "./AdminRoutes.jsx";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {PublicRoutes}
        {AdminRoutes}
      </Routes>
    </BrowserRouter>
  );
}
