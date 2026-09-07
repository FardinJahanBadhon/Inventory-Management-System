import { LocationCategory } from "@prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../shared/types/auth";
import type { PaginatedData } from "../../shared/types/api";
import { buildPaginationMeta, toSkipTake } from "../../shared/utils/pagination";
import { findLocationById } from "../locations/location-repository";
import { findProductById } from "../products/product-repository";
import {
  createInventory as createInventoryRecord,
  decrementInventoryQuantity,
  findInventory as findInventoryRecords,
  findInventoryById,
  type InventoryWithRelations,
} from "./inventory-repository";
import type {
  DistributeInventoryInput,
  GetInventoryQuery,
  InitializeInventoryInput,
  TrashInventoryInput,
} from "./inventory-schema";
import type { InventoryResponse } from "./inventory-types";

function toInventoryResponse(inventory: InventoryWithRelations): InventoryResponse {
  return {
    id: inventory.id,
    productId: inventory.productId,
    product: inventory.product,
    locationId: inventory.locationId,
    location: inventory.location,
    quantity: inventory.quantity,
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
  };
}

// ADMINISTRATION may view any location's inventory (optionally scoped by
// the locationId/productId query filters). Every other category is always
// scoped to their own location — a locationId they send is validated for
// shape by the Zod schema but never trusted as authorization; it is
// silently overridden here, never rejected as an error, so an operational
// user always simply sees their own inventory regardless of what they ask
// for.
export async function getInventory(
  query: GetInventoryQuery,
  authenticatedUser: AuthenticatedUser,
): Promise<PaginatedData<InventoryResponse>> {
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const isAdministration = authenticatedUser.locationCategory === LocationCategory.ADMINISTRATION;

  const filters = {
    productId: query.productId,
    locationId: isAdministration ? query.locationId : authenticatedUser.locationId,
  };

  const { items, total } = await findInventoryRecords(filters, { skip, take });

  return {
    items: items.map(toInventoryResponse),
    meta: buildPaginationMeta(total, query.page, query.pageSize),
  };
}

// Administration-only (enforced by requireAdministrationAccess in
// inventory-routes.ts). Always INSERTS a new row — see
// inventory-repository.ts's createInventory for why this never searches
// for an existing Product+Location row to merge into. Neither the product
// nor the destination location is required to be active: nothing in the
// source requirements restricts initialization to active
// products/locations, so no such rule was invented here.
export async function initializeInventory(
  input: InitializeInventoryInput,
): Promise<InventoryResponse> {
  const product = await findProductById(input.productId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const location = await findLocationById(input.locationId);

  if (!location) {
    throw new NotFoundError("Location not found");
  }

  const created = await createInventoryRecord({
    productId: input.productId,
    locationId: input.locationId,
    quantity: input.quantity,
  });

  return toInventoryResponse(created);
}

// Shared by Distribute and Trash — both are "decrease this Inventory row,
// which must belong to my own location" with identical mechanics; they
// differ only in business intent, which the two exported wrapper
// functions below name explicitly (per the Engineering Conventions rule
// against one generic action covering distinct business operations).
async function decreaseOwnInventoryQuantity(
  inventoryId: string,
  requestedQuantity: number,
  authenticatedUser: AuthenticatedUser,
): Promise<InventoryResponse> {
  const existing = await findInventoryById(inventoryId);

  if (!existing) {
    throw new NotFoundError("Inventory record not found");
  }

  if (existing.locationId !== authenticatedUser.locationId) {
    // Deliberately the same "not found"-shaped rejection a real ownership
    // violation should get — see ForbiddenError below; existence was
    // already established, so this is specifically a 403, not a 404.
    throw new ForbiddenError("This inventory record does not belong to your location");
  }

  // Existence and ownership are already confirmed above and cannot change
  // for this row (locationId is immutable, and nothing ever deletes an
  // Inventory row) — so if the guarded decrement below still affects zero
  // rows, the only remaining explanation is insufficient quantity, possibly
  // because a concurrent request consumed it between our read and now.
  const updated = await decrementInventoryQuantity(
    inventoryId,
    authenticatedUser.locationId,
    requestedQuantity,
  );

  if (!updated) {
    throw new BadRequestError("Requested quantity exceeds available quantity");
  }

  return toInventoryResponse(updated);
}

export function distributeInventory(
  inventoryId: string,
  input: DistributeInventoryInput,
  authenticatedUser: AuthenticatedUser,
): Promise<InventoryResponse> {
  return decreaseOwnInventoryQuantity(inventoryId, input.quantity, authenticatedUser);
}

export function trashInventory(
  inventoryId: string,
  input: TrashInventoryInput,
  authenticatedUser: AuthenticatedUser,
): Promise<InventoryResponse> {
  return decreaseOwnInventoryQuantity(inventoryId, input.quantity, authenticatedUser);
}
