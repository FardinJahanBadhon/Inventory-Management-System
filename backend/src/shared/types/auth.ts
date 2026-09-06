import type { LocationCategory } from "@prisma/client";

// The server-trusted identity attached to a request after `authenticateRequest`
// verifies a JWT. Every field here comes from the token's verified claims —
// never from the request body, query string, or URL parameters. This is the
// only source authorization checks (requireAdministrationAccess,
// requireOperationalLocationAccess, and future per-resource ownership
// checks) are allowed to read a user's location from.
export interface AuthenticatedUser {
  userId: string;
  locationId: string;
  locationCategory: LocationCategory;
}
