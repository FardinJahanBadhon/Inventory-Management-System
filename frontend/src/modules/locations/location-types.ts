import type { LocationCategory } from "@/types/location-category";

// Mirrors backend/src/modules/locations/location-types.ts's LocationResponse
// exactly. Dates cross the wire as ISO strings, not Date objects.
export interface Location {
  id: string;
  name: string;
  category: LocationCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  category: LocationCategory;
  isActive: boolean;
}

export interface UpdateLocationInput {
  name?: string;
  category?: LocationCategory;
  isActive?: boolean;
}

export interface GetLocationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: LocationCategory;
  isActive?: boolean;
}
