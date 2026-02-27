import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./ui/PageLoader";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { loading, user, bootstrapNotice } = useAuth();

  if (loading) {
    return <PageLoader message="Loading account..." notice={bootstrapNotice ?? undefined} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
