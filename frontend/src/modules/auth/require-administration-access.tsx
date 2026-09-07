import { ProtectedRoute } from "@/components/common/protected-route";
import { ROUTES } from "@/routes/paths";
import { useAuth } from "./use-auth";

// The category half of route protection, layered inside RequireAuth's
// authentication check (see app/router.tsx) — only reached by an already
// -authenticated user. A non-ADMINISTRATION category sees the existing
// Unauthorized page rather than being bounced to /login (they ARE
// authenticated; they just lack the category this route group needs).
// This is a usability convenience only — every underlying API call is
// independently enforced by the backend's own
// `requireAdministrationAccess` middleware regardless of what this shows.
export function RequireAdministrationAccess() {
  const { locationCategory } = useAuth();

  return <ProtectedRoute isAllowed={locationCategory === "ADMINISTRATION"} redirectTo={ROUTES.unauthorized} />;
}
