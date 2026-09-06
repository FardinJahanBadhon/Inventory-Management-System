import type { LocationCategory } from "@prisma/client";

// The full Location row is already safe to return as-is (no password-like
// field to strip), but this type exists so the API contract is explicit
// and doesn't silently change if the Prisma model grows an internal-only
// field later.
export interface LocationResponse {
  id: string;
  name: string;
  category: LocationCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
