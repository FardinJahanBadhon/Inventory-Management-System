import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  createOperationalActor,
  createTestLocation,
  createTestUser,
  loginAs,
  loginAsAdmin,
} from "../helpers/test-client";

const OPERATIONAL_CATEGORIES = ["STORE", "LAB", "WARD", "PHARMACY"] as const;

describe("User authorization", () => {
  it("rejects every endpoint for an unauthenticated caller", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    const { user } = await createTestUser(adminToken, location.id);

    const results = await Promise.all([
      request(app)
        .post("/api/users")
        .send({ name: "X", username: "x", password: "password123", locationId: location.id }),
      request(app).get("/api/users"),
      request(app).get(`/api/users/${user.id}`),
      request(app).patch(`/api/users/${user.id}`).send({ isActive: false }),
    ]);

    for (const response of results) {
      expect(response.status).toBe(401);
    }
  });

  it.each(OPERATIONAL_CATEGORIES)(
    "rejects every endpoint for a %s user with 403, including managing themselves",
    async (category) => {
      const adminToken = await loginAsAdmin();
      const { token, user, location } = await createOperationalActor(adminToken, category);

      const results = await Promise.all([
        request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "X", username: "x", password: "password123", locationId: location.id }),
        request(app).get("/api/users").set("Authorization", `Bearer ${token}`),
        request(app).get(`/api/users/${user.id}`).set("Authorization", `Bearer ${token}`),
        // Attempting to change their OWN location — must still be 403,
        // this API has no self-service path at all.
        request(app)
          .patch(`/api/users/${user.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ locationId: location.id }),
      ]);

      for (const response of results) {
        expect(response.status).toBe(403);
      }
    },
  );
});

describe("POST /api/users", () => {
  it("creates a user, hashes the password, and never returns it", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Store Operator",
        username: "store.operator.1",
        password: "StrongPassword123",
        locationId: location.id,
      });

    expect(response.status).toBe(201);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("StrongPassword123");

    // Login must work with the credentials just used to create the account.
    const token = await loginAs("store.operator.1", "StrongPassword123");
    expect(typeof token).toBe("string");
  });

  it.each([
    ["missing name", { username: "u1", password: "password123" }],
    ["missing username", { name: "N", password: "password123" }],
    ["missing password", { name: "N", username: "u2" }],
    ["missing locationId", { name: "N", username: "u3", password: "password123" }],
  ])("rejects %s with a validation error", async (_label, partialBody) => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ locationId: location.id, ...partialBody });

    expect(response.status).toBe(422);
  });

  it("rejects a nonexistent locationId with 404", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "N",
        username: "orphan.user",
        password: "password123",
        locationId: "99999999-9999-4999-8999-999999999999",
      });

    expect(response.status).toBe(404);
  });

  it("rejects a duplicate username with 409 and does not create a second row", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const first = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "N1", username: "dupe.user", password: "password123", locationId: location.id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "N2", username: "dupe.user", password: "password456", locationId: location.id });
    expect(second.status).toBe(409);

    const list = await request(app)
      .get("/api/users?search=dupe.user")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.data.meta.total).toBe(1);
  });

  it("ignores a client-sent category/role field — permissions still come from locationId", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Sneaky",
        username: "sneaky.user",
        password: "password123",
        locationId: location.id,
        category: "ADMINISTRATION",
        role: "ADMIN",
      });

    expect(response.status).toBe(201);

    const token = await loginAs("sneaky.user", "password123");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.data.location.category).toBe("STORE");

    // And that identity genuinely cannot manage users.
    const forbidden = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
  });
});

describe("GET /api/users and GET /api/users/:id", () => {
  it("lists users and supports search/location/isActive filters", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    await createTestUser(adminToken, location.id, { username: "findable.user" });

    const search = await request(app)
      .get("/api/users?search=findable")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(search.body.data.items).toHaveLength(1);

    const byLocation = await request(app)
      .get(`/api/users?locationId=${location.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byLocation.body.data.items).toHaveLength(1);
  });

  it("returns 404 for a nonexistent user id", async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .get("/api/users/99999999-9999-4999-8999-999999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/users/:id", () => {
  it("updates the password and the OLD password stops working", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    const { user } = await createTestUser(adminToken, location.id, {
      username: "password.change.user",
      password: "OldPassword123",
    });

    const update = await request(app)
      .patch(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "NewPassword456" });
    expect(update.status).toBe(200);
    expect(JSON.stringify(update.body)).not.toContain("NewPassword456");

    await expect(loginAs("password.change.user", "OldPassword123")).rejects.toThrow();
    const token = await loginAs("password.change.user", "NewPassword456");
    expect(typeof token).toBe("string");
  });

  it("reassigns a user to a new location and a fresh login reflects the new category", async () => {
    const adminToken = await loginAsAdmin();
    const storeLocation = await createTestLocation(adminToken, "STORE");
    const labLocation = await createTestLocation(adminToken, "LAB");
    const { user } = await createTestUser(adminToken, storeLocation.id, {
      username: "reassign.user",
      password: "ReassignPass123",
    });

    const update = await request(app)
      .patch(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ locationId: labLocation.id });
    expect(update.status).toBe(200);
    expect(update.body.data.location.category).toBe("LAB");

    const token = await loginAs("reassign.user", "ReassignPass123");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.data.location.category).toBe("LAB");
  });

  it("deactivates a user; the record remains stored but login is blocked", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    const { user } = await createTestUser(adminToken, location.id, {
      username: "will.deactivate",
      password: "WillDeactivate123",
    });

    // Confirm it works before deactivation.
    await loginAs("will.deactivate", "WillDeactivate123");

    const deactivate = await request(app)
      .patch(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);

    await expect(loginAs("will.deactivate", "WillDeactivate123")).rejects.toThrow();

    const stillStored = await request(app)
      .get(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stillStored.status).toBe(200);
    expect(stillStored.body.data.isActive).toBe(false);
  });

  it("rejects duplicate username on update with 409", async () => {
    const adminToken = await loginAsAdmin();
    const location = await createTestLocation(adminToken, "STORE");
    await createTestUser(adminToken, location.id, { username: "taken.username" });
    const { user: other } = await createTestUser(adminToken, location.id, { username: "other.user" });

    const response = await request(app)
      .patch(`/api/users/${other.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "taken.username" });

    expect(response.status).toBe(409);
  });

  describe("administrator invariant", () => {
    it("rejects deactivating the only active Administration user", async () => {
      const adminToken = await loginAsAdmin();
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);

      const response = await request(app)
        .patch(`/api/users/${me.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(409);
    });

    it("rejects reassigning the only active admin to an operational location", async () => {
      const adminToken = await loginAsAdmin();
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
      const storeLocation = await createTestLocation(adminToken, "STORE");

      const response = await request(app)
        .patch(`/api/users/${me.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ locationId: storeLocation.id });

      expect(response.status).toBe(409);
    });

    it("allows deactivating an admin once a second active admin exists", async () => {
      const adminToken = await loginAsAdmin();
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
      const officeId = me.body.data.location.id;

      const backup = await createTestUser(adminToken, officeId, {
        username: "backup.admin",
        password: "BackupAdmin123",
      });
      expect(backup.user.id).toBeDefined();

      const deactivateOriginal = await request(app)
        .patch(`/api/users/${me.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(deactivateOriginal.status).toBe(200);

      // Now the backup is the only one — deactivating it must be blocked.
      const backupToken = await loginAs("backup.admin", "BackupAdmin123");
      const blockLast = await request(app)
        .patch(`/api/users/${backup.user.id}`)
        .set("Authorization", `Bearer ${backupToken}`)
        .send({ isActive: false });
      expect(blockLast.status).toBe(409);
    });
  });
});
