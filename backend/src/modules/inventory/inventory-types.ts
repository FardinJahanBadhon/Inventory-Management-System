import type { LocationCategory } from "@prisma/client";

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

// One Inventory row, never aggregated with any other row — Product +
// Location is intentionally not unique (see PROJECT_RULES.md), so a
// product/location pair can be represented by several of these.
export interface InventoryResponse {
  id: string;
  productId: string;
  product: InventoryProductContext;
  locationId: string;
  location: InventoryLocationContext;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}
