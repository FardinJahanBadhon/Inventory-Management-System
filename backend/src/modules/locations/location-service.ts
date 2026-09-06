import { LocationCategory, type Location } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error";
import type { PaginatedData } from "../../shared/types/api";
import { buildPaginationMeta, toSkipTake } from "../../shared/utils/pagination";
import {
  countLocationsByCategory,
  createLocation as createLocationRecord,
  findLocationById,
  findLocations as findLocationRecords,
  updateLocation as updateLocationRecord,
} from "./location-repository";
import type { CreateLocationInput, GetLocationsQuery, UpdateLocationInput } from "./location-schema";
import type { LocationResponse } from "./location-types";

function toLocationResponse(location: Location): LocationResponse {
  return {
    id: location.id,
    name: location.name,
    category: location.category,
    isActive: location.isActive,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

// The database's partial unique index (see PROJECT_RULES.md) is the
// last-resort guarantee that at most one Location can ever have
// category = ADMINISTRATION. This is the first-resort check, so a client
// attempting to create or promote a second one gets a clear, intentional
// 409 instead of a raw constraint-violation error.
async function assertNoExistingAdministrationLocation(): Promise<void> {
  const count = await countLocationsByCategory(LocationCategory.ADMINISTRATION);

  if (count > 0) {
    throw new ConflictError(
      "An Administration-category location already exists; only one may exist at a time",
    );
  }
}

export async function createLocation(input: CreateLocationInput): Promise<LocationResponse> {
  if (input.category === LocationCategory.ADMINISTRATION) {
    await assertNoExistingAdministrationLocation();
  }

  const created = await createLocationRecord(input);
  return toLocationResponse(created);
}

export async function getLocations(
  query: GetLocationsQuery,
): Promise<PaginatedData<LocationResponse>> {
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const { items, total } = await findLocationRecords(
    { search: query.search, category: query.category, isActive: query.isActive },
    { skip, take },
  );

  return {
    items: items.map(toLocationResponse),
    meta: buildPaginationMeta(total, query.page, query.pageSize),
  };
}

export async function getLocationById(id: string): Promise<LocationResponse> {
  const location = await findLocationById(id);

  if (!location) {
    throw new NotFoundError("Location not found");
  }

  return toLocationResponse(location);
}

// Protects the Administration Office invariant: whichever Location
// currently has category = ADMINISTRATION is, by construction (the
// database allows only one), the Administration Office. An update that
// would deactivate it or move its category away from ADMINISTRATION is
// rejected outright, regardless of what else is in the same request.
//
// A pure name change on the Administration Office is allowed — the
// invariant the system must preserve is "one active ADMINISTRATION
// location exists," which name has no bearing on.
export async function updateLocation(
  id: string,
  input: UpdateLocationInput,
): Promise<LocationResponse> {
  const existing = await findLocationById(id);

  if (!existing) {
    throw new NotFoundError("Location not found");
  }

  const isAdministrationOffice = existing.category === LocationCategory.ADMINISTRATION;

  if (isAdministrationOffice) {
    if (input.isActive === false) {
      throw new ConflictError(
        "The Administration Office cannot be deactivated — the system must always have one active Administration location",
      );
    }

    if (input.category !== undefined && input.category !== LocationCategory.ADMINISTRATION) {
      throw new ConflictError(
        "The Administration Office's category cannot be changed away from ADMINISTRATION",
      );
    }
  } else if (input.category === LocationCategory.ADMINISTRATION) {
    // Promoting a different location to ADMINISTRATION is still subject to
    // the singleton rule.
    await assertNoExistingAdministrationLocation();
  }

  const updated = await updateLocationRecord(id, input);
  return toLocationResponse(updated);
}
