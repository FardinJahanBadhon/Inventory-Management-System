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

const OPERATIONAL_CATEGORIES = ["STORE", "LAB", "WARD", "PHARMACY"] as const;

describe("GET /api/inventory — viewing and location scoping", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/inventory");
    expect(response.status).toBe(401);
  });

  it("lets Administration view inventory across every location", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    for (const category of OPERATIONAL_CATEGORIES) {
      const { location } = await createOperationalActor(adminToken, category);
      await initializeTestInventory(adminToken, product.id, location.id, 10);
    }

    const response = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.meta.total).toBe(4);
  });

  it.each(OPERATIONAL_CATEGORIES)(
    "restricts a %s user to only their own location's inventory",
    async (category) => {
      const adminToken = await loginAsAdmin();
      const product = await createTestProduct(adminToken);

      const own = await createOperationalActor(adminToken, category);
      await initializeTestInventory(adminToken, product.id, own.location.id, 10);

      // Some other operational location's inventory that must never be visible.
      const other = await createOperationalActor(
        adminToken,
        category === "STORE" ? "LAB" : "STORE",
      );
      await initializeTestInventory(adminToken, product.id, other.location.id, 20);

      const response = await request(app)
        .get("/api/inventory")
        .set("Authorization", `Bearer ${own.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.meta.total).toBe(1);
      expect(response.body.data.items[0].locationId).toBe(own.location.id);
    },
  );

  it("ignores a client-supplied locationId for operational users (cannot see another location)", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    const ward = await createOperationalActor(adminToken, "WARD");
    await initializeTestInventory(adminToken, product.id, ward.location.id, 40);

    const pharmacy = await createOperationalActor(adminToken, "PHARMACY");
    await initializeTestInventory(adminToken, product.id, pharmacy.location.id, 20);

    const attempts = [
      `/api/inventory?locationId=${pharmacy.location.id}`,
      `/api/inventory?productId=${product.id}&locationId=${pharmacy.location.id}`,
      `/api/inventory?locationId=`,
      `/api/inventory?locationId=not-a-valid-uuid`,
    ];

    for (const url of attempts) {
      const response = await request(app).get(url).set("Authorization", `Bearer ${ward.token}`);
      // A malformed locationId (empty or invalid) is a 422 from the query
      // schema; a well-formed-but-someone-else's id is silently overridden
      // (200, own data only) — neither path ever returns Pharmacy's row.
      if (response.status === 200) {
        expect(response.body.data.items.every((item: { locationId: string }) => item.locationId === ward.location.id)).toBe(true);
      } else {
        expect(response.status).toBe(422);
      }
    }
  });
});

describe("POST /api/inventory/initialize", () => {
  it("is Administration-only", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    for (const category of OPERATIONAL_CATEGORIES) {
      const { token, location } = await createOperationalActor(adminToken, category);
      const response = await request(app)
        .post("/api/inventory/initialize")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: product.id, locationId: location.id, quantity: 10 });
      expect(response.status).toBe(403);
    }
  });

  it("creates a new Inventory row for a valid request", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId: product.id, locationId: location.id, quantity: 100 });

    expect(response.status).toBe(201);
    expect(response.body.data.quantity).toBe(100);
    expect(response.body.data.product.id).toBe(product.id);
    expect(response.body.data.location.id).toBe(location.id);
  });

  it.each(OPERATIONAL_CATEGORIES)("admin can initialize stock at a %s location", async (category) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, category);

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId: product.id, locationId: location.id, quantity: 25 });

    expect(response.status).toBe(201);
  });

  it("rejects a nonexistent product with 404", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productId: "99999999-9999-4999-8999-999999999999",
        locationId: location.id,
        quantity: 10,
      });

    expect(response.status).toBe(404);
  });

  it("rejects a nonexistent location with 404", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        locationId: "99999999-9999-4999-8999-999999999999",
        quantity: 10,
      });

    expect(response.status).toBe(404);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["non-integer", 10.5],
    ["string", "abc"],
  ])("rejects a %s quantity", async (_label, quantity) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId: product.id, locationId: location.id, quantity });

    expect(response.status).toBe(422);
  });

  it("rejects a missing quantity", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId: product.id, locationId: location.id });

    expect(response.status).toBe(422);
  });
});

describe("CRITICAL: Product + Location is not unique", () => {
  it("creates TWO separate rows for repeated initialization, never merges them", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");

    const first = await initializeTestInventory(adminToken, product.id, location.id, 100);
    const second = await initializeTestInventory(adminToken, product.id, location.id, 50);

    expect(first.id).not.toBe(second.id);

    const response = await request(app)
      .get(`/api/inventory?locationId=${location.id}&productId=${product.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.body.data.items).toHaveLength(2);
    const quantities = response.body.data.items
      .map((item: { quantity: number }) => item.quantity)
      .sort((a: number, b: number) => a - b);
    expect(quantities).toEqual([50, 100]);

    const total = quantities.reduce((sum: number, q: number) => sum + q, 0);
    expect(total).toBe(150);
  });
});

describe("POST /api/inventory/:id/distribute", () => {
  it("is rejected for Administration", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ quantity: 10 });

    expect(response.status).toBe(403);
  });

  it.each(OPERATIONAL_CATEGORIES)("lets a %s user distribute their own inventory", async (category) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, category);
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 30 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(70);
  });

  it("rejects distributing inventory owned by another location, body unchanged", async () => {
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
      .send({ quantity: 10, locationId: ward.location.id });

    expect(response.status).toBe(403);

    // Pharmacy's inventory must remain exactly as it was.
    const check = await request(app)
      .get(`/api/inventory?locationId=${pharmacy.location.id}`)
      .set("Authorization", `Bearer ${pharmacy.token}`);
    expect(check.body.data.items[0].quantity).toBe(100);
  });

  it("succeeds when distributing exactly the available quantity, reaching zero", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 70);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 70 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(0);
  });

  it("rejects a request exceeding available quantity, leaving it unchanged", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 101 });

    expect(response.status).toBe(400);

    const check = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    expect(check.body.data.items[0].quantity).toBe(100);
  });

  it.each([
    ["zero", 0],
    ["negative", -10],
  ])("rejects a %s distribution quantity", async (_label, quantity) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity });

    expect(response.status).toBe(422);
  });

  it("does not create a destination row — total row count is unchanged", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const before = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${adminToken}`);
    const countBefore = before.body.data.meta.total;

    const distribute = await request(app)
      .post(`/api/inventory/${inventory.id}/distribute`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 10 });
    expect(distribute.status).toBe(200);

    const after = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(after.body.data.meta.total).toBe(countBefore);
  });
});

describe("POST /api/inventory/:id/trash", () => {
  it("is rejected for Administration", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/trash`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ quantity: 10 });

    expect(response.status).toBe(403);
  });

  it.each(OPERATIONAL_CATEGORIES)("lets a %s user trash their own inventory", async (category) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, category);
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/trash`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 25 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(75);
  });

  it("rejects trashing inventory owned by another location", async () => {
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
      .post(`/api/inventory/${pharmacyInventory.id}/trash`)
      .set("Authorization", `Bearer ${ward.token}`)
      .send({ quantity: 10 });

    expect(response.status).toBe(403);
  });

  it("does not delete the Inventory row even when quantity reaches zero", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 20);

    const trash = await request(app)
      .post(`/api/inventory/${inventory.id}/trash`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity: 20 });
    expect(trash.status).toBe(200);
    expect(trash.body.data.quantity).toBe(0);

    const check = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    expect(check.body.data.items).toHaveLength(1);
    expect(check.body.data.items[0].quantity).toBe(0);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["exceeding available", 999],
  ])("rejects a %s trash quantity", async (_label, quantity) => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const response = await request(app)
      .post(`/api/inventory/${inventory.id}/trash`)
      .set("Authorization", `Bearer ${actor.token}`)
      .send({ quantity });

    expect([400, 422]).toContain(response.status);
  });
});
