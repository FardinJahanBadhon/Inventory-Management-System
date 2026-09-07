import type { LocationCategory } from "@/types/location-category";

export interface InventoryProductContext {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export interface InventoryLocationContext {
  id: string;
  name: string;
  category: LocationCategory;
}

// Mirrors backend/src/modules/inventory/inventory-types.ts's
// InventoryResponse exactly: one row, never aggregated with another.
// Product + Location is NOT unique — several rows can legitimately share
// the same productId/locationId (see PROJECT_RULES.md). Never merge these
// client-side.
export interface InventoryRecord {
  id: string;
  productId: string;
  product: InventoryProductContext;
  locationId: string;
  location: InventoryLocationContext;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface InitializeInventoryInput {
  productId: string;
  locationId: string;
  quantity: number;
}

// Distribute and Trash both take only a quantity — the target row comes
// from the URL (its id), and the source location is always the
// authenticated caller's own (enforced server-side; there is no
// locationId field on either request).
export interface QuantityMutationInput {
  quantity: number;
}

export interface GetInventoryParams {
  page?: number;
  pageSize?: number;
  locationId?: string;
  productId?: string;
}
