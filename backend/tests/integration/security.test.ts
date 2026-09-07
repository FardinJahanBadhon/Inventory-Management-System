import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  createOperationalActor,
  createTestLocation,
  createTestProduct,
  initializeTestInventory,
  loginAsAdmin,
} from "../helpers/test-client";
import { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } from "../helpers/bootstrap";

// Consolidated attack-scenario suite. Individual module test files already
// cover ownership/authorization per-endpoint; this file specifically
// targets the cross-cutting RULES from the Phase 10 brief that span
// multiple modules — client-controlled identity, privilege escalation via
// unexpected fields/headers, and response-body data exposure.

describe("RULE 19: client-provided location/category/role cannot override server-side authorization", () => {
  it("a custom X-Location-Id / X-User-Role header has no effect on distribute ownership", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const ward = await createOperationalActor(adminToken, "WARD");
    const pharmacy = await createOperationalActor(adminToken, "PHARMACY");
    const pharmacyInventory = await initializeTestInventory(
      adminToken,
      product.id,
      pharmacy.location.id,
      100,
    );

    const response = await request(app)
      .post(`/api/inventory/${pharmacyInventory.id}/distribute`)
      .set("Authorization", `Bearer ${ward.token}`)
      .set("X-Location-Id", pharmacy.location.id)
      .set("X-User-Role", "ADMINISTRATION")
      .send({ quantity: 10 });

    expect(response.status).toBe(403);
  });

  it("a locationId/category field injected into every operational request body is ignored", async () => {
    const adminToken = await loginAsAdmin();
    const { token, location } = await createOperationalActor(adminToken, "STORE");

    const escalationAttempts = [
      request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "X", name: "X", unit: "box", category: "ADMINISTRATION" }),
      request(app)
        .post("/api/locations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "X", category: "STORE", locationCategory: "ADMINISTRATION" }),
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "X",
          username: "escalation.user",
          password: "password123",
          locationId: location.id,
          role: "ADMINISTRATION",
        }),
      request(app)
        .post("/api/inventory/initialize")
        .set("Authorization", `Bearer ${token}`)
        .send({
          productId: "99999999-9999-4999-8999-999999999999",
          locationId: location.id,
          quantity: 10,
          locationCategory: "ADMINISTRATION",
        }),
    ];

    const results = await Promise.all(escalationAttempts);
    for (const response of results) {
      expect(response.status).toBe(403);
    }
  });

  it("userId in the request body cannot impersonate another user for /api/auth/me", async () => {
    const adminToken = await loginAsAdmin();
    const { token, user } = await createOperationalActor(adminToken, "STORE");

    // /api/auth/me takes no body at all — but confirm sending one (with a
    // fake target userId) is simply ignored and the real identity wins.
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: "00000000-0000-4000-8000-000000000000" });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(user.id);
  });
});

describe("RULE 18 / data exposure: passwordHash and secrets never appear in any response", () => {
  it("checks every module's success responses for leaked sensitive fields", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    const product = await createTestProduct(adminToken);
    const { token: storeToken, user } = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, location.id, 50);

    const responses = await Promise.all([
      request(app).post("/api/auth/login").send({
        username: TEST_ADMIN_USERNAME,
        password: TEST_ADMIN_PASSWORD,
      }),
      request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`),
      request(app).get("/api/locations").set("Authorization", `Bearer ${adminToken}`),
      request(app).get(`/api/users/${user.id}`).set("Authorization", `Bearer ${adminToken}`),
      request(app).get("/api/products").set("Authorization", `Bearer ${adminToken}`),
      request(app).get("/api/inventory").set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post(`/api/inventory/${inventory.id}/distribute`)
        .set("Authorization", `Bearer ${storeToken}`)
        .send({ quantity: 1 }),
    ]);

    for (const response of responses) {
      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain("passwordHash");
      expect(raw.toLowerCase()).not.toContain("jwt_secret");
      expect(raw).not.toContain(process.env.JWT_SECRET);
    }
  });

  it("does not leak a stack trace or raw Prisma error text for an unexpected server-side failure", async () => {
    const adminToken = await loginAsAdmin();

    // A structurally valid but semantically nonsensical request that could
    // tempt a naive implementation into forwarding a raw driver error —
    // confirm the centralized handler's generic shape holds even here.
    const response = await request(app)
      .patch("/api/locations/99999999-9999-4999-8999-999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Anything" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: expect.any(String),
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("Horizontal privilege escalation across identical operational categories", () => {
  it("a Store user cannot act on another Store location's inventory just because the category matches", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const storeA = await createOperationalActor(adminToken, "STORE");
    const storeB = await createOperationalActor(adminToken, "STORE");
    const storeBInventory = await initializeTestInventory(
      adminToken,
      product.id,
      storeB.location.id,
      100,
    );

    const response = await request(app)
      .post(`/api/inventory/${storeBInventory.id}/distribute`)
      .set("Authorization", `Bearer ${storeA.token}`)
      .send({ quantity: 10 });

    expect(response.status).toBe(403);
  });
});

describe("Vertical privilege escalation: JWT cannot be upgraded after issuance", () => {
  it("reassigning a user's location does not retroactively change their already-issued token", async () => {
    const adminToken = await loginAsAdmin();
    const store = await createOperationalActor(adminToken, "STORE");
    const officeResponse = await request(app)
      .get("/api/locations?category=ADMINISTRATION")
      .set("Authorization", `Bearer ${adminToken}`);
    const officeId = officeResponse.body.data.items[0].id;

    // Promote the user to the Administration Office AFTER their token was issued.
    await request(app)
      .patch(`/api/users/${store.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ locationId: officeId });

    // The OLD token must still carry the OLD (Store) claims — it is not
    // magically upgraded — so it must still be refused Administration-only
    // actions.
    const attemptWithOldToken = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${store.token}`)
      .send({ code: "SHOULD-FAIL", name: "X", unit: "box" });

    expect(attemptWithOldToken.status).toBe(403);
  });
});
