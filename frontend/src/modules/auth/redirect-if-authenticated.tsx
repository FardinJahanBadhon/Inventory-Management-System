import { Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "@/components/common/page-loader";
import { ROUTES } from "@/routes/paths";
import { useAuth } from "./use-auth";

// Guards /login: a visitor who is already authenticated is sent to the
// authenticated app instead of seeing the login form again. Where they
// land depends on category — ADMINISTRATION and operational users have
// different dashboards (see app/router.tsx) — the same branch login-page.tsx
// uses right after a fresh login.
export function RedirectIfAuthenticated() {
  const { isAuthenticated, isInitializing, locationCategory } = useAuth();

  if (isInitializing) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={locationCategory === "ADMINISTRATION" ? ROUTES.dashboard : ROUTES.operationsDashboard}
        replace
      />
    );
  }

  return <Outlet />;
}
