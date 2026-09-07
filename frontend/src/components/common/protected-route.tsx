import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "@/routes/paths";

interface ProtectedRouteProps {
  isAllowed: boolean;
  redirectTo?: string;
}

// Generic route-guard shell for a nested-route group in the router
// (element: <ProtectedRoute isAllowed={...} />, children: [...]).
// Phase 12 (Authentication UI & Session) will pass `isAllowed` computed
// from real session state — "is authenticated" for the outer guard, "is
// this location category permitted" for an admin-only group. No auth state
// exists yet, so nothing in the router calls this with a real value yet;
// it exists so Phase 12 wires state into routing rather than inventing the
// routing mechanism from scratch.
export function ProtectedRoute({ isAllowed, redirectTo = ROUTES.login }: ProtectedRouteProps) {
  return isAllowed ? <Outlet /> : <Navigate to={redirectTo} replace />;
}
