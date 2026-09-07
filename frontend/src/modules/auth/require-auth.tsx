import { PageLoader } from "@/components/common/page-loader";
import { ProtectedRoute } from "@/components/common/protected-route";
import { useAuth } from "./use-auth";

// The authentication half of Phase 11's route-guard foundation
// (components/common/protected-route.tsx): gates every route nested under
// it on "is there a valid session", showing a full-page loader while that
// is still being determined (see auth-initializer.tsx) instead of
// redirecting prematurely and flickering to /login on every page load.
export function RequireAuth() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <PageLoader />;
  }

  return <ProtectedRoute isAllowed={isAuthenticated} />;
}
