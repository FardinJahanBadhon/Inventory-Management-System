// Mirrors the backend's `LocationCategory` Prisma enum (backend/prisma/schema.prisma)
// exactly. These five categories are fixed and never user-creatable — see
// PROJECT_RULES.md, Business Rule #1. Do not add a category here that
// doesn't exist on the backend enum, or vice versa.
export const LOCATION_CATEGORIES = [
  "ADMINISTRATION",
  "STORE",
  "LAB",
  "WARD",
  "PHARMACY",
] as const;

export type LocationCategory = (typeof LOCATION_CATEGORIES)[number];

// The four categories that can Distribute/Trash but never Initialize —
// mirrors the backend's `requireOperationalLocationAccess` middleware
// grouping (backend/src/middlewares/authorize.ts): everything that isn't
// ADMINISTRATION.
export const OPERATIONAL_LOCATION_CATEGORIES = ["STORE", "LAB", "WARD", "PHARMACY"] as const;

