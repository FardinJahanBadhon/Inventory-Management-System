import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAsAdmin } from "../helpers/test-client";
import { TEST_ADMINISTRATION_OFFICE_NAME, ensureBootstrap } from "../helpers/bootstrap";

describe("Regression: health and bootstrap", () => {
  it("GET /health reports a healthy, connected backend", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe("connected");
  });

  it("returns a consistent 404 envelope for an unknown route", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("the Administration Office and default admin exist after bootstrap", async () => {
    const adminToken = await loginAsAdmin();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);

    expect(me.body.data.location.name).toBe(TEST_ADMINISTRATION_OFFICE_NAME);
    expect(me.body.data.location.category).toBe("ADMINISTRATION");
  });

  it("bootstrap is idempotent — running it again does not duplicate the office or admin", async () => {
    // The global beforeEach already left the office+admin in place via
    // resetAndBootstrapTestDatabase; now run the REAL find-or-create
    // bootstrap logic (mirroring prisma/seed.ts) against that existing
    // state, twice, and confirm neither run creates a duplicate.
    await ensureBootstrap();
    await ensureBootstrap();

    const adminToken = await loginAsAdmin();
    const locations = await request(app)
      .get("/api/locations?category=ADMINISTRATION")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(locations.body.data.meta.total).toBe(1);

    const users = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(users.body.data.meta.total).toBe(1);
  });
});

describe("Regression: full end-to-end business scenario", () => {
  it("bootstrap -> create location -> create user -> create product -> initialize -> view -> distribute -> trash -> verify", async () => {
    const adminToken = await loginAsAdmin();

    // 2. Create an operational location.
    const location = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ward E2E", category: "WARD" });
    expect(location.status).toBe(201);
    const locationId = location.body.data.id;

    // 3. Create an operational user assigned to it.
    const user = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ward E2E User",
        username: "ward.e2e.user",
        password: "WardE2EPass123",
        locationId,
      });
    expect(user.status).toBe(201);

    // 4. Create a product.
    const product = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "E2E-SKU-001", name: "E2E Test Product", unit: "box" });
    expect(product.status).toBe(201);
    const productId = product.body.data.id;

    // 5. Admin initializes inventory.
    const initialize = await request(app)
      .post("/api/inventory/initialize")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productId, locationId, quantity: 200 });
    expect(initialize.status).toBe(201);
    const inventoryId = initialize.body.data.id;

    // 6. Operational user views own inventory.
    const wardLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "ward.e2e.user", password: "WardE2EPass123" });
    expect(wardLogin.status).toBe(200);
    const wardToken = wardLogin.body.data.accessToken;

    const view = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${wardToken}`);
    expect(view.status).toBe(200);
    expect(view.body.data.items).toHaveLength(1);
    expect(view.body.data.items[0].quantity).toBe(200);

    // 7. Operational user distributes stock.
    const distribute = await request(app)
      .post(`/api/inventory/${inventoryId}/distribute`)
      .set("Authorization", `Bearer ${wardToken}`)
      .send({ quantity: 50 });
    expect(distribute.status).toBe(200);
    expect(distribute.body.data.quantity).toBe(150);

    // 8. Operational user trashes stock.
    const trash = await request(app)
      .post(`/api/inventory/${inventoryId}/trash`)
      .set("Authorization", `Bearer ${wardToken}`)
      .send({ quantity: 20 });
    expect(trash.status).toBe(200);
    expect(trash.body.data.quantity).toBe(130);

    // 9. Admin views updated inventory across the system.
    const adminView = await request(app)
      .get(`/api/inventory?locationId=${locationId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminView.status).toBe(200);

    // 10. Verify final quantities and records: 200 - 50 - 20 = 130, one row.
    expect(adminView.body.data.items).toHaveLength(1);
    expect(adminView.body.data.items[0].quantity).toBe(130);
    expect(adminView.body.data.items[0].id).toBe(inventoryId);
  });
});
