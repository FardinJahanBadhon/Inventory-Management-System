import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  createOperationalActor,
  createTestLocation,
  createTestProduct,
  loginAsAdmin,
} from "../helpers/test-client";

const OPERATIONAL_CATEGORIES = ["STORE", "LAB", "WARD", "PHARMACY"] as const;

describe("Product authorization", () => {
  it("rejects every endpoint for an unauthenticated caller", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    const results = await Promise.all([
      request(app).post("/api/products").send({ code: "X", name: "X", unit: "box" }),
      request(app).get("/api/products"),
      request(app).get(`/api/products/${product.id}`),
      request(app).patch(`/api/products/${product.id}`).send({ isActive: false }),
    ]);

    for (const response of results) {
      expect(response.status).toBe(401);
    }
  });

  it.each(OPERATIONAL_CATEGORIES)("rejects every endpoint for a %s user with 403", async (category) => {
    const adminToken = await loginAsAdmin();
    const { token } = await createOperationalActor(adminToken, category);
    const product = await createTestProduct(adminToken);

    const results = await Promise.all([
      request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "X", name: "X", unit: "box" }),
      request(app).get("/api/products").set("Authorization", `Bearer ${token}`),
      request(app).get(`/api/products/${product.id}`).set("Authorization", `Bearer ${token}`),
      request(app)
        .patch(`/api/products/${product.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false }),
    ]);

    for (const response of results) {
      expect(response.status).toBe(403);
    }
  });
});

describe("POST /api/products", () => {
  it("creates a product and ignores client-controlled id/isActive/createdAt", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: "SKU-TEST-001",
        name: "Test Product",
        unit: "box",
        id: "11111111-1111-4111-8111-111111111111",
        isActive: false,
        createdAt: "2000-01-01T00:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).not.toBe("11111111-1111-4111-8111-111111111111");
    expect(response.body.data.isActive).toBe(true);
    expect(new Date(response.body.data.createdAt).getFullYear()).toBeGreaterThan(2020);
  });

  it.each([
    ["missing code", { name: "N", unit: "box" }],
    ["missing name", { code: "C1", unit: "box" }],
    ["missing unit", { code: "C2", name: "N" }],
    ["empty code", { code: "", name: "N", unit: "box" }],
    ["wrong type for code", { code: 123, name: "N", unit: "box" }],
  ])("rejects %s with a validation error", async (_label, body) => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
    expect(response.status).toBe(422);
  });

  it("rejects a duplicate code with 409 and does not create a second row", async () => {
    const adminToken = await loginAsAdmin();
    const first = await createTestProduct(adminToken, { code: "DUPE-001" });
    expect(first.code).toBe("DUPE-001");

    const second = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "DUPE-001", name: "Different Name", unit: "box" });
    expect(second.status).toBe(409);

    const list = await request(app)
      .get("/api/products?search=DUPE-001")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.data.meta.total).toBe(1);
  });
});

describe("GET /api/products and GET /api/products/:id", () => {
  it("searches by code or name, case-insensitively", async () => {
    const adminToken = await loginAsAdmin();
    await createTestProduct(adminToken, { code: "PARA-500", name: "Paracetamol 500mg" });

    const response = await request(app)
      .get("/api/products?search=paracetamol")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.body.data.items).toHaveLength(1);
  });

  it("filters by isActive", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    await request(app)
      .patch(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    const activeOnly = await request(app)
      .get("/api/products?isActive=true")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(
      activeOnly.body.data.items.find((item: { id: string }) => item.id === product.id),
    ).toBeUndefined();

    const inactiveOnly = await request(app)
      .get("/api/products?isActive=false")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(
      inactiveOnly.body.data.items.find((item: { id: string }) => item.id === product.id),
    ).toBeDefined();
  });

  it("returns 404 for a nonexistent product id", async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .get("/api/products/99999999-9999-4999-8999-999999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/products/:id — deactivation preserves the record", () => {
  it("does not delete the product on deactivation", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    const deactivate = await request(app)
      .patch(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);

    const stillThere = await request(app)
      .get(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stillThere.status).toBe(200);
  });

  it("preserves Inventory references after the referenced product is deactivated", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const location = await createTestLocation(adminToken, "STORE");

    const inventory = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId: product.id, locationId: location.id, quantity: 50 });
    expect(inventory.status).toBe(201);

    const deactivate = await request(app)
      .patch(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);

    const inventoryList = await request(app)
      .get(`/api/inventory?locationId=${location.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(inventoryList.body.data.items).toHaveLength(1);
    expect(inventoryList.body.data.items[0].productId).toBe(product.id);
  });
});
