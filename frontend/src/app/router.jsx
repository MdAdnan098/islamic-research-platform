import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout.jsx";
import Home from "../pages/public/Home.jsx";
import SectionPage from "../pages/public/SectionPage.jsx";
import TopicPage from "../pages/public/TopicPage.jsx";
import ArticlePage from "../pages/public/ArticlePage.jsx";
import NotFound from "../pages/public/NotFound.jsx";
import LatestPage from "../pages/public/LatestPage.jsx";
import About from "../pages/public/About.jsx";
import LegalPage from "../pages/public/LegalPage.jsx";
import LivePage from "../pages/public/LivePage.jsx";
import CoursesPage from "../pages/public/CoursesPage.jsx";
import CoursePage from "../pages/public/CoursePage.jsx";

// Admin is a separate bundle — public visitors never download it.
const AdminApp = lazy(() => import("../admin/AdminApp.jsx"));

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="aqaid" element={<SectionPage section="aqaid" />} />
        <Route path="aqaid/:topicSlug" element={<TopicPage section="aqaid" />} />
        <Route path="masail" element={<SectionPage section="masail" />} />
        <Route path="masail/:topicSlug" element={<TopicPage section="masail" />} />
        <Route path="latest" element={<LatestPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:slug" element={<CoursePage />} />
        <Route path="article/:slug" element={<ArticlePage />} />
        <Route path="about" element={<About />} />
        <Route path="disclaimer" element={<LegalPage kind="disclaimer" />} />
        <Route path="privacy" element={<LegalPage kind="privacy" />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin/*" element={<Suspense fallback={<div className="p-10 text-sm text-mute">Loading…</div>}><AdminApp /></Suspense>} />
    </Routes>
  );
}
