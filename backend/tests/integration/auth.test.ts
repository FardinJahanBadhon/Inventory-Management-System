import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  app,
  createOperationalActor,
  loginAsAdmin,
} from "../helpers/test-client";
import { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } from "../helpers/bootstrap";

describe("POST /api/auth/login", () => {
  it("returns a token and safe user context for valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.accessToken).toBe("string");
    expect(response.body.data.user.username).toBe(TEST_ADMIN_USERNAME);
    expect(response.body.data.user.location.category).toBe("ADMINISTRATION");

    // RULE 18: passwords are never returned.
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain(TEST_ADMIN_PASSWORD);
  });

  it("rejects an incorrect password with a generic message", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: TEST_ADMIN_USERNAME, password: "WrongPassword123" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeUndefined();
    expect(response.body.message).toBe("Invalid username or password");
  });

  it("rejects an unknown username with the SAME generic message (no enumeration)", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "does-not-exist", password: "WhateverPassword123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid username or password");
  });

  it("rejects a deactivated user with the same generic message", async () => {
    const adminToken = await loginAsAdmin();
    const { location } = await createOperationalActor(adminToken, "STORE");

    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Deactivated User",
        username: "deactivated.user",
        password: "DeactivatedPass123",
        locationId: location.id,
      });
    expect(created.status).toBe(201);

    const deactivate = await request(app)
      .patch(`/api/users/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);

    const loginAttempt = await request(app)
      .post("/api/auth/login")
      .send({ username: "deactivated.user", password: "DeactivatedPass123" });

    expect(loginAttempt.status).toBe(401);
    expect(loginAttempt.body.message).toBe("Invalid username or password");
  });

  it.each([
    ["missing username", { password: "SomePassword123" }],
    ["missing password", { username: TEST_ADMIN_USERNAME }],
    ["empty username", { username: "", password: "SomePassword123" }],
    ["empty password", { username: TEST_ADMIN_USERNAME, password: "" }],
    ["wrong type for username", { username: 123, password: "SomePassword123" }],
    ["wrong type for password", { username: TEST_ADMIN_USERNAME, password: 123 }],
  ])("rejects %s with a validation error", async (_label, body) => {
    const response = await request(app).post("/api/auth/login").send(body);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user's identity, location, and category", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.username).toBe(TEST_ADMIN_USERNAME);
    expect(response.body.data.location).toBeDefined();
    expect(response.body.data.location.category).toBe("ADMINISTRATION");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("rejects a request with no Authorization header", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects a malformed Bearer header", async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `NotBearer ${adminToken}`);
    expect(response.status).toBe(401);
  });

  it("rejects a syntactically invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer this-is-not-a-jwt");
    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expiredToken = jwt.sign(
      {
        userId: "00000000-0000-4000-8000-000000000000",
        username: TEST_ADMIN_USERNAME,
        locationId: "00000000-0000-4000-8000-000000000000",
        locationCategory: "ADMINISTRATION",
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "-10s" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret (forgery)", async () => {
    const forgedToken = jwt.sign(
      {
        userId: "00000000-0000-4000-8000-000000000000",
        username: TEST_ADMIN_USERNAME,
        locationId: "00000000-0000-4000-8000-000000000000",
        locationCategory: "ADMINISTRATION",
      },
      "attacker-guessed-secret",
      { expiresIn: "1h" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${forgedToken}`);
    expect(response.status).toBe(401);
  });

  it("rejects a token missing required identity fields", async () => {
    const incompletePayloadToken = jwt.sign(
      { userId: "00000000-0000-4000-8000-000000000000" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${incompletePayloadToken}`);
    expect(response.status).toBe(401);
  });
});
