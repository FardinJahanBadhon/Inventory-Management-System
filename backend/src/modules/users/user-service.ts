import { LocationCategory } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error";
import { hashPassword } from "../../lib/password";
import type { PaginatedData } from "../../shared/types/api";
import { buildPaginationMeta, toSkipTake } from "../../shared/utils/pagination";
import { findLocationById } from "../locations/location-repository";
import {
  countActiveUsersByLocationCategory,
  createUser as createUserRecord,
  findUserById,
  findUserByUsername,
  findUsers as findUserRecords,
  updateUser as updateUserRecord,
  type UserWithLocation,
} from "./user-repository";
import type { CreateUserInput, GetUsersQuery, UpdateUserInput } from "./user-schema";
import type { UserResponse } from "./user-types";

function toUserResponse(user: UserWithLocation): UserResponse {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    locationId: user.locationId,
    location: user.location,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// A pre-check for a clear, intentional 409 — the database's own unique
// constraint on `username` remains the final protection against a race
// between two concurrent create/update requests (Phase 4's error handler
// already maps that raw constraint violation to a generic 409 if it's ever
// actually hit).
async function assertUsernameAvailable(username: string, excludeUserId?: string): Promise<void> {
  const existing = await findUserByUsername(username);

  if (existing && existing.id !== excludeUserId) {
    throw new ConflictError("This username is already taken");
  }
}

async function assertLocationExists(
  locationId: string,
): Promise<{ id: string; category: LocationCategory }> {
  const location = await findLocationById(locationId);

  if (!location) {
    throw new NotFoundError("Location not found");
  }

  return location;
}

export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  await assertUsernameAvailable(input.username);
  await assertLocationExists(input.locationId);

  const passwordHash = await hashPassword(input.password);

  const created = await createUserRecord({
    name: input.name,
    username: input.username,
    passwordHash,
    locationId: input.locationId,
    isActive: input.isActive,
  });

  return toUserResponse(created);
}

export async function getUsers(query: GetUsersQuery): Promise<PaginatedData<UserResponse>> {
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const { items, total } = await findUserRecords(
    { search: query.search, locationId: query.locationId, isActive: query.isActive },
    { skip, take },
  );

  return {
    items: items.map(toUserResponse),
    meta: buildPaginationMeta(total, query.page, query.pageSize),
  };
}

export async function getUserById(id: string): Promise<UserResponse> {
  const user = await findUserById(id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return toUserResponse(user);
}

// Protects the Core Rule "the system must always have an administrative
// user associated with the Administration Office": if this user is
// currently the only active user assigned to an ADMINISTRATION-category
// location, an update that would deactivate them or move them to a
// different location's category is rejected — mirroring the Administration
// Office location-level protection from Phase 6.
async function assertAdministratorInvariantPreserved(
  existing: UserWithLocation,
  input: UpdateUserInput,
  destinationCategory: LocationCategory | undefined,
): Promise<void> {
  const wasLoadBearingAdmin =
    existing.isActive && existing.location.category === LocationCategory.ADMINISTRATION;

  if (!wasLoadBearingAdmin) {
    return;
  }

  const willBeActive = input.isActive ?? existing.isActive;
  const willBeAdminCategory =
    destinationCategory !== undefined ? destinationCategory === LocationCategory.ADMINISTRATION : true;

  if (willBeActive && willBeAdminCategory) {
    return;
  }

  const otherActiveAdmins = await countActiveUsersByLocationCategory(
    LocationCategory.ADMINISTRATION,
    existing.id,
  );

  if (otherActiveAdmins === 0) {
    throw new ConflictError(
      "At least one active Administration user must remain — deactivate or reassign a different administrator first",
    );
  }
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserResponse> {
  const existing = await findUserById(id);

  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (input.username !== undefined && input.username !== existing.username) {
    await assertUsernameAvailable(input.username, id);
  }

  let destinationCategory: LocationCategory | undefined;

  if (input.locationId !== undefined && input.locationId !== existing.locationId) {
    const destination = await assertLocationExists(input.locationId);
    destinationCategory = destination.category;
  }

  await assertAdministratorInvariantPreserved(existing, input, destinationCategory);

  const passwordHash = input.password !== undefined ? await hashPassword(input.password) : undefined;

  const updated = await updateUserRecord(id, {
    name: input.name,
    username: input.username,
    passwordHash,
    locationId: input.locationId,
    isActive: input.isActive,
  });

  return toUserResponse(updated);
}
