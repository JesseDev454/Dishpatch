import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageLoader } from "./components/ui/PageLoader";

const LandingPage = lazy(() => import("./pages/LandingPage").then((mod) => ({ default: mod.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((mod) => ({ default: mod.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((mod) => ({ default: mod.RegisterPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((mod) => ({ default: mod.DashboardPage })));
const PublicOrderPage = lazy(() => import("./pages/PublicOrderPage").then((mod) => ({ default: mod.PublicOrderPage })));
const LiveOrdersPage = lazy(() => import("./pages/LiveOrdersPage").then((mod) => ({ default: mod.LiveOrdersPage })));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage").then((mod) => ({ default: mod.ReceiptPage })));
const DashboardAnalyticsPage = lazy(() =>
  import("./pages/DashboardAnalyticsPage").then((mod) => ({ default: mod.DashboardAnalyticsPage }))
);

export default function App() {
  const location = useLocation();
  const themeClass =
    location.pathname.startsWith("/dashboard") || location.pathname === "/login" || location.pathname === "/register"
      ? "theme-admin"
      : "theme-customer";

  useEffect(() => {
    document.body.classList.remove("theme-admin", "theme-customer");
    document.body.classList.add(themeClass);
  }, [themeClass]);

  return (
    <Suspense
      fallback={<PageLoader message="Loading page..." />}
    >
      <div key={location.pathname} className="page-enter">
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/r/:slug" element={<PublicOrderPage />} />
          <Route path="/receipt/:reference" element={<ReceiptPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/orders"
            element={
              <ProtectedRoute>
                <LiveOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute>
                <DashboardAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Suspense>
  );
}
