import type { LocationCategory } from "@/types/location-category";

export interface UserLocationContext {
  id: string;
  name: string;
  category: LocationCategory;
  isActive: boolean;
}

// Mirrors backend/src/modules/users/user-types.ts's UserResponse exactly —
// never a password or passwordHash field, on any endpoint in this module.
export interface User {
  id: string;
  name: string;
  username: string;
  locationId: string;
  location: UserLocationContext;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  username: string;
  password: string;
  locationId: string;
  isActive: boolean;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  password?: string;
  locationId?: string;
  isActive?: boolean;
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  locationId?: string;
  isActive?: boolean;
}
