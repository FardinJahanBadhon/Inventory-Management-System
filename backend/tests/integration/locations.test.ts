import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  createOperationalActor,
  createTestLocation,
  loginAsAdmin,
} from "../helpers/test-client";

const OPERATIONAL_CATEGORIES = ["STORE", "LAB", "WARD", "PHARMACY"] as const;

describe("Location authorization", () => {
  it("rejects every endpoint for an unauthenticated caller", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const results = await Promise.all([
      request(app).post("/api/locations").send({ name: "X", category: "STORE" }),
      request(app).get("/api/locations"),
      request(app).get(`/api/locations/${location.id}`),
      request(app).patch(`/api/locations/${location.id}`).send({ isActive: false }),
    ]);

    for (const response of results) {
      expect(response.status).toBe(401);
    }
  });

  it.each(OPERATIONAL_CATEGORIES)(
    "rejects every endpoint for a %s user with 403",
    async (category) => {
      const adminToken = await loginAsAdmin();
      const { token } = await createOperationalActor(adminToken, category);
      const location = await createTestLocation(adminToken, "STORE");

      const results = await Promise.all([
        request(app)
          .post("/api/locations")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "X", category: "STORE" }),
        request(app).get("/api/locations").set("Authorization", `Bearer ${token}`),
        request(app)
          .get(`/api/locations/${location.id}`)
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .patch(`/api/locations/${location.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ isActive: false }),
      ]);

      for (const response of results) {
        expect(response.status).toBe(403);
      }
    },
  );

  it("does not treat a client-sent locationCategory: ADMINISTRATION as proof of authorization", async () => {
    const adminToken = await loginAsAdmin();
    const { token } = await createOperationalActor(adminToken, "STORE");

    const response = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", category: "STORE", locationCategory: "ADMINISTRATION", role: "ADMIN" });

    expect(response.status).toBe(403);
  });
});

describe("POST /api/locations", () => {
  it("creates a location with a fixed category", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Central Store", category: "STORE" });

    expect(response.status).toBe(201);
    expect(response.body.data.category).toBe("STORE");
    expect(response.body.data.isActive).toBe(true);
  });

  it("rejects an invalid category value", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bad Category", category: "WAREHOUSE" });

    expect(response.status).toBe(422);
  });

  it("rejects an empty name", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "", category: "STORE" });

    expect(response.status).toBe(422);
  });

  it("allows multiple locations with the same operational category", async () => {
    const adminToken = await loginAsAdmin();

    const first = await createTestLocation(adminToken, "STORE", { name: "Store A" });
    const second = await createTestLocation(adminToken, "STORE", { name: "Store B" });

    expect(first.id).not.toBe(second.id);
  });

  it("rejects creating a second ADMINISTRATION-category location", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fake HQ", category: "ADMINISTRATION" });

    expect(response.status).toBe(409);
  });
});

describe("GET /api/locations and GET /api/locations/:id", () => {
  it("lists locations and supports filtering by category and isActive", async () => {
    const adminToken = await loginAsAdmin();
    await createTestLocation(adminToken, "STORE");
    await createTestLocation(adminToken, "LAB");

    const all = await request(app)
      .get("/api/locations")
      .set("Authorization", `Bearer ${adminToken}`);
    // Administration Office + the two just created.
    expect(all.body.data.meta.total).toBe(3);

    const storeOnly = await request(app)
      .get("/api/locations?category=STORE")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(storeOnly.body.data.items).toHaveLength(1);
    expect(storeOnly.body.data.items[0].category).toBe("STORE");
  });

  it("returns 404 for a nonexistent (but well-formed) id", async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .get("/api/locations/99999999-9999-4999-8999-999999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });

  it("returns 422 for a malformed id", async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .get("/api/locations/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(422);
  });
});

describe("PATCH /api/locations/:id — Administration Office invariant", () => {
  async function getAdministrationOffice(adminToken: string) {
    const response = await request(app)
      .get("/api/locations?category=ADMINISTRATION")
      .set("Authorization", `Bearer ${adminToken}`);
    return response.body.data.items[0];
  }

  it("rejects deactivating the Administration Office", async () => {
    const adminToken = await loginAsAdmin();
    const office = await getAdministrationOffice(adminToken);

    const response = await request(app)
      .patch(`/api/locations/${office.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(response.status).toBe(409);

    const stillActive = await getAdministrationOffice(adminToken);
    expect(stillActive.isActive).toBe(true);
  });

  it("rejects changing the Administration Office's category", async () => {
    const adminToken = await loginAsAdmin();
    const office = await getAdministrationOffice(adminToken);

    const response = await request(app)
      .patch(`/api/locations/${office.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ category: "STORE" });

    expect(response.status).toBe(409);
  });

  it("rejects a combined rename+deactivate with NO partial effect", async () => {
    const adminToken = await loginAsAdmin();
    const office = await getAdministrationOffice(adminToken);

    const response = await request(app)
      .patch(`/api/locations/${office.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Hijacked", isActive: false });

    expect(response.status).toBe(409);

    const unchanged = await getAdministrationOffice(adminToken);
    expect(unchanged.name).toBe(office.name);
    expect(unchanged.isActive).toBe(true);
  });

  it("allows a pure rename of the Administration Office", async () => {
    const adminToken = await loginAsAdmin();
    const office = await getAdministrationOffice(adminToken);

    const response = await request(app)
      .patch(`/api/locations/${office.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Head Office" });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Head Office");
  });

  it("deactivates and reactivates an ordinary operational location", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const deactivate = await request(app)
      .patch(`/api/locations/${location.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);

    // RULE: deactivation, never hard deletion — the record must still exist.
    const stillThere = await request(app)
      .get(`/api/locations/${location.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stillThere.status).toBe(200);

    const reactivate = await request(app)
      .patch(`/api/locations/${location.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(reactivate.body.data.isActive).toBe(true);
  });
});
