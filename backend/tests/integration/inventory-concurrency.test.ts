import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  createOperationalActor,
  createTestProduct,
  initializeTestInventory,
  loginAsAdmin,
} from "../helpers/test-client";

// This suite exists specifically to prove the atomic conditional decrement
// in inventory-repository.ts (`updateMany` with both the ownership and
// `quantity >= requestedQuantity` guards in one WHERE clause) actually
// prevents the classic check-then-decrement race, not just that it looks
// correct on paper. Every scenario fires genuinely concurrent HTTP
// requests via Promise.all — not sequential awaits — against the shared
// in-memory Express app.
async function distribute(token: string, inventoryId: string, quantity: number) {
  return request(app)
    .post(`/api/inventory/${inventoryId}/distribute`)
    .set("Authorization", `Bearer ${token}`)
    .send({ quantity });
}

describe("Inventory concurrency safety", () => {
  it("70 + 50 against 100: exactly one succeeds, final quantity is never negative", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const [resultA, resultB] = await Promise.all([
      distribute(actor.token, inventory.id, 70),
      distribute(actor.token, inventory.id, 50),
    ]);

    const statuses = [resultA.status, resultB.status].sort();
    // One must succeed (200), the other must be rejected as insufficient (400).
    expect(statuses).toEqual([200, 400]);

    const finalCheck = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    const finalQuantity = finalCheck.body.data.items[0].quantity;

    expect(finalQuantity).toBeGreaterThanOrEqual(0);
    // Both 70 and 50 individually fit within 100 — it's only their SUM
    // (120) that doesn't. Which one's UPDATE commits first (and therefore
    // wins) is a genuine race with no guaranteed winner, so the expected
    // remaining quantity must be derived from whichever one actually
    // succeeded, not hardcoded to assume the 70 always wins.
    const winningQuantity = resultA.status === 200 ? 70 : 50;
    expect(finalQuantity).toBe(100 - winningQuantity);
  });

  it("50 + 50 against 100: both may succeed, final quantity is exactly 0", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const [resultA, resultB] = await Promise.all([
      distribute(actor.token, inventory.id, 50),
      distribute(actor.token, inventory.id, 50),
    ]);

    expect(resultA.status).toBe(200);
    expect(resultB.status).toBe(200);

    const finalCheck = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    expect(finalCheck.body.data.items[0].quantity).toBe(0);
  });

  it("60 + 60 against 100: at most one succeeds, quantity never negative, total consumed <= 100", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const [resultA, resultB] = await Promise.all([
      distribute(actor.token, inventory.id, 60),
      distribute(actor.token, inventory.id, 60),
    ]);

    const successCount = [resultA, resultB].filter((r) => r.status === 200).length;
    const failureCount = [resultA, resultB].filter((r) => r.status === 400).length;

    expect(successCount).toBeLessThanOrEqual(1);
    expect(successCount + failureCount).toBe(2);

    const finalCheck = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    const finalQuantity = finalCheck.body.data.items[0].quantity;

    expect(finalQuantity).toBeGreaterThanOrEqual(0);
    const consumed = 100 - finalQuantity;
    expect(consumed).toBeLessThanOrEqual(100);
    expect(consumed).toBe(successCount === 1 ? 60 : 0);
  });

  it("repeats the 70+50 race 10 times to catch intermittent failures", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);

    for (let iteration = 0; iteration < 10; iteration += 1) {
      const actor = await createOperationalActor(adminToken, "STORE");
      const inventory = await initializeTestInventory(
        adminToken,
        product.id,
        actor.location.id,
        100,
      );

      const [resultA, resultB] = await Promise.all([
        distribute(actor.token, inventory.id, 70),
        distribute(actor.token, inventory.id, 50),
      ]);

      const statuses = [resultA.status, resultB.status].sort();
      expect(statuses, `iteration ${iteration}`).toEqual([200, 400]);

      const finalCheck = await request(app)
        .get(`/api/inventory?locationId=${actor.location.id}`)
        .set("Authorization", `Bearer ${actor.token}`);
      // See the comment on the single-race test above: either request can
      // legitimately win, so the expected remaining quantity is derived
      // from the actual winner rather than assumed to always be 30 (which
      // silently assumes the 70 always wins — it doesn't, and asserting
      // that produced an intermittent false failure whenever 50 won).
      const winningQuantity = resultA.status === 200 ? 70 : 50;
      expect(finalCheck.body.data.items[0].quantity, `iteration ${iteration}`).toBe(100 - winningQuantity);
    }
  });

  it("three-way concurrent distribution never oversells", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const results = await Promise.all([
      distribute(actor.token, inventory.id, 40),
      distribute(actor.token, inventory.id, 40),
      distribute(actor.token, inventory.id, 40),
    ]);

    const successCount = results.filter((r) => r.status === 200).length;
    // 40*3 = 120 > 100, so at most two of the three can fit (80 <= 100).
    expect(successCount).toBeLessThanOrEqual(2);

    const finalCheck = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    const finalQuantity = finalCheck.body.data.items[0].quantity;
    expect(finalQuantity).toBeGreaterThanOrEqual(0);
    expect(finalQuantity).toBe(100 - successCount * 40);
  });

  it("concurrent distribute + trash against the same row never goes negative", async () => {
    const adminToken = await loginAsAdmin();
    const product = await createTestProduct(adminToken);
    const actor = await createOperationalActor(adminToken, "STORE");
    const inventory = await initializeTestInventory(adminToken, product.id, actor.location.id, 100);

    const [distributeResult, trashResult] = await Promise.all([
      distribute(actor.token, inventory.id, 70),
      request(app)
        .post(`/api/inventory/${inventory.id}/trash`)
        .set("Authorization", `Bearer ${actor.token}`)
        .send({ quantity: 50 }),
    ]);

    const statuses = [distributeResult.status, trashResult.status].sort();
    expect(statuses).toEqual([200, 400]);

    const finalCheck = await request(app)
      .get(`/api/inventory?locationId=${actor.location.id}`)
      .set("Authorization", `Bearer ${actor.token}`);
    expect(finalCheck.body.data.items[0].quantity).toBeGreaterThanOrEqual(0);
    expect(finalCheck.body.data.items[0].quantity).toBe(30);
  });
});
