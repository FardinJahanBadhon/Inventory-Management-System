import { ProtectedRoute } from "@/components/common/protected-route";
import { ROUTES } from "@/routes/paths";
import { OPERATIONAL_LOCATION_CATEGORIES } from "@/types/location-category";
import { useAuth } from "./use-auth";

// The operational counterpart to require-administration-access.tsx,
// layered inside RequireAuth's authentication check (see app/router.tsx)
// — only reached by an already-authenticated user. An ADMINISTRATION
// category sees the existing Unauthorized page rather than being bounced
// to /login (they ARE authenticated; they just lack the category this
// route group needs). Usability convenience only — every underlying
// Distribute/Trash API call is independently enforced by the backend's
// own `requireOperationalLocationAccess` middleware regardless of what
// this shows or hides.
export function RequireOperationalAccess() {
  const { locationCategory } = useAuth();

  const isOperational =
    locationCategory !== null &&
    (OPERATIONAL_LOCATION_CATEGORIES as readonly string[]).includes(locationCategory);

  return <ProtectedRoute isAllowed={isOperational} redirectTo={ROUTES.unauthorized} />;
}
