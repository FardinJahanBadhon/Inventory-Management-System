import type { LocationCategory } from "@prisma/client";

// The location context every safe user-facing response embeds — never
// passwordHash, never anything not needed to render a profile/nav.
export interface SafeLocationContext {
  id: string;
  name: string;
  category: LocationCategory;
}

export interface SafeUserProfile {
  id: string;
  username: string;
  name: string;
  location: SafeLocationContext;
}

export interface LoginResult {
  accessToken: string;
  user: SafeUserProfile;
}
