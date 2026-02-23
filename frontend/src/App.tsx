import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageLoader } from "./components/ui/PageLoader";

const LoginPage = lazy(() => import("./pages/LoginPage").then((mod) => ({ default: mod.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((mod) => ({ default: mod.RegisterPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((mod) => ({ default: mod.DashboardPage })));
const PaymentCallbackPage = lazy(() =>
  import("./pages/PaymentCallbackPage").then((mod) => ({ default: mod.PaymentCallbackPage }))
);
const PublicOrderPage = lazy(() => import("./pages/PublicOrderPage").then((mod) => ({ default: mod.PublicOrderPage })));
const LiveOrdersPage = lazy(() => import("./pages/LiveOrdersPage").then((mod) => ({ default: mod.LiveOrdersPage })));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage").then((mod) => ({ default: mod.ReceiptPage })));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader message="Loading Dishpatch..." />;
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Suspense
      fallback={<PageLoader message="Loading page..." />}
    >
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:slug" element={<PublicOrderPage />} />
        <Route path="/payment/callback" element={<PaymentCallbackPage />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
