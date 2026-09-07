import type { LocationCategory } from "@/types/location-category";

export interface LocationFormValues {
  name: string;
  category: LocationCategory | "";
}

export interface LocationFormErrors {
  name?: string;
  category?: string;
}

// Usability-only validation — required fields. Uniqueness, the
// Administration Office singleton, and every other business invariant
// remain backend-authoritative (see PROJECT_RULES.md).
export function validateLocationForm({ name, category }: LocationFormValues): LocationFormErrors {
  const errors: LocationFormErrors = {};

  if (!name.trim()) {
    errors.name = "Name is required";
  }
  if (!category) {
    errors.category = "Category is required";
  }

  return errors;
}
