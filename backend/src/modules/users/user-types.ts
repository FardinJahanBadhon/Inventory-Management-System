import type { LocationCategory } from "@prisma/client";

export interface UserLocationContext {
  id: string;
  name: string;
  category: LocationCategory;
  isActive: boolean;
}

// Never includes passwordHash — this is the one shape every User
// Management endpoint (create/list/get/update) returns.
export interface UserResponse {
  id: string;
  name: string;
  username: string;
  locationId: string;
  location: UserLocationContext;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
