import type { LocationCategory } from "@/types/location-category";

// Mirrors backend/src/modules/auth/auth-types.ts's SafeLocationContext /
// SafeUserProfile / LoginResult exactly — only fields the backend actually
// returns. There is no `isActive` here because SafeUserProfile doesn't
// include one; a deactivated account never reaches this shape in the
// first place (login and /me both reject it server-side).
export interface AuthenticatedLocation {
  id: string;
  name: string;
  category: LocationCategory;
}

export interface AuthenticatedUserProfile {
  id: string;
  username: string;
  name: string;
  location: AuthenticatedLocation;
}

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUserProfile;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
