import path from "node:path";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeEach } from "vitest";
import type { prisma as PrismaSingleton } from "../src/lib/prisma";
import type { resetAndBootstrapTestDatabase as ResetFn } from "./helpers/bootstrap";

// CRITICAL ORDERING NOTE — read before touching this file.
//
// `loadEnv(...)` MUST execute before src/config (and anything that
// transitively imports it, e.g. src/lib/prisma) is ever evaluated. Static
// ES `import` statements are hoisted — ALL of them run, in order, before
// any other top-level code in this module — regardless of where they
// appear in the source text. That means a plain
// `import { prisma } from "../src/lib/prisma"` anywhere in this file,
// even textually below the loadEnv() call, would still evaluate
// src/config (which reads process.env.DATABASE_URL at import time) BEFORE
// loadEnv() below ever runs.
//
// This is exactly what happened during Phase 10 development: a hoisted
// import silently baked the DEVELOPMENT database's DATABASE_URL into the
// app's config/Prisma singleton, and resetAndBootstrapTestDatabase then
// wiped that database instead of the test one. Plain `require()` doesn't
// work here either (Vitest's module runner doesn't resolve extensionless
// TS paths through it). A dynamic `import()`, unlike a static import
// declaration, is NOT hoisted — it executes exactly where it's awaited —
// so the two src imports below are deliberately deferred into the first
// beforeEach call, after loadEnv() has already run. Do not replace these
// with static imports.
loadEnv({ path: path.resolve(__dirname, "../.env.test"), override: true });

let prisma: typeof PrismaSingleton;
let resetAndBootstrapTestDatabase: typeof ResetFn;

beforeEach(async () => {
  if (!resetAndBootstrapTestDatabase) {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ resetAndBootstrapTestDatabase } = await import("./helpers/bootstrap.js"));
  }

  await resetAndBootstrapTestDatabase();
});

afterAll(async () => {
  await prisma?.$disconnect();
});
