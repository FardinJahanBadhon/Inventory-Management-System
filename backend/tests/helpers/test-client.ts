import request from "supertest";
import type { LocationCategory } from "@prisma/client";
import { createApp } from "../../src/app";
import { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } from "./bootstrap";

// supertest binds directly to the Express app instance (an ephemeral
// server per request) — no app.listen() / real port needed, and no risk
// of colliding with a dev server that happens to be running.
export const app = createApp();

export interface TestLocation {
  id: string;
  name: string;
  category: LocationCategory;
  isActive: boolean;
}

export interface TestUser {
  id: string;
  username: string;
  locationId: string;
}

export interface TestProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
}

export interface TestInventory {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
}

let uniqueCounter = 0;
// Guarantees distinct usernames/codes/names across tests within the same
// process run without needing to coordinate — each call gets its own
// number, appended to whatever base the caller wants.
export function unique(base: string): string {
  uniqueCounter += 1;
  return `${base}-${Date.now()}-${uniqueCounter}`;
}

export async function loginAs(username: string, password: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ username, password });

  if (response.status !== 200) {
    throw new Error(
      `loginAs(${username}) failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.data.accessToken as string;
}

export async function loginAsAdmin(): Promise<string> {
  return loginAs(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
}

export async function createTestLocation(
  adminToken: string,
  category: LocationCategory,
  overrides: Partial<{ name: string; isActive: boolean }> = {},
): Promise<TestLocation> {
  const response = await request(app)
    .post("/api/locations")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: overrides.name ?? unique(`Test ${category} Location`),
      category,
      ...(overrides.isActive !== undefined ? { isActive: overrides.isActive } : {}),
    });

  if (response.status !== 201) {
    throw new Error(
      `createTestLocation(${category}) failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.data as TestLocation;
}

export async function createTestUser(
  adminToken: string,
  locationId: string,
  overrides: Partial<{ name: string; username: string; password: string; isActive: boolean }> = {},
): Promise<{ user: TestUser; password: string }> {
  const username = overrides.username ?? unique("user");
  const password = overrides.password ?? "TestUserPass123!";

  const response = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: overrides.name ?? "Test User",
      username,
      password,
      locationId,
      ...(overrides.isActive !== undefined ? { isActive: overrides.isActive } : {}),
    });

  if (response.status !== 201) {
    throw new Error(
      `createTestUser failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return { user: response.body.data as TestUser, password };
}

// Convenience: create a location + an active user in it + log that user
// in, for the very common "I need a Store/Lab/Ward/Pharmacy user" case.
export async function createOperationalActor(
  adminToken: string,
  category: LocationCategory,
): Promise<{ location: TestLocation; user: TestUser; token: string }> {
  const location = await createTestLocation(adminToken, category);
  const { user, password } = await createTestUser(adminToken, location.id);
  const token = await loginAs(user.username, password);
  return { location, user, token };
}

export async function createTestProduct(
  adminToken: string,
  overrides: Partial<{ code: string; name: string; unit: string }> = {},
): Promise<TestProduct> {
  const response = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: overrides.code ?? unique("SKU"),
      name: overrides.name ?? "Test Product",
      unit: overrides.unit ?? "box",
    });

  if (response.status !== 201) {
    throw new Error(
      `createTestProduct failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.data as TestProduct;
}

export async function initializeTestInventory(
  adminToken: string,
  productId: string,
  locationId: string,
  quantity: number,
): Promise<TestInventory> {
  const response = await request(app)
    .post("/api/inventory/initialize")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ productId, locationId, quantity });

  if (response.status !== 201) {
    throw new Error(
      `initializeTestInventory failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.data as TestInventory;
}
