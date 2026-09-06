# Project Rules

Non-negotiable guardrails for this codebase, derived from the three source
specification documents (System Requirements, Database Design, Engineering
Conventions). Every phase of implementation must respect these. If a change
would violate one of these rules, stop and raise it instead of proceeding.

## Business Rules

1. There are exactly five fixed location categories: `ADMINISTRATION`,
   `STORE`, `LAB`, `WARD`, `PHARMACY`. They are represented as a database
   enum and are never user-creatable, renamable, or deletable.
2. The system must always have an active `Administration Office` location
   and at least one active administrative user. This is bootstrapped
   automatically on startup and must never be violated by a deactivation.
3. Every user belongs to exactly one location, set at creation and never
   changeable afterward — not via request body, URL, query string, or
   frontend state.
4. A user's effective permissions are derived entirely from their assigned
   location's `category`. There is no separate `role` field.
5. **Product + Location is NOT unique.** Never add
   `@@unique([productId, locationId])` or any equivalent constraint.
   Multiple `Inventory` rows for the same product at the same location are
   valid and expected. Any "total at this location" figure must be computed
   with `SUM(quantity)`, never assumed from a single row.
6. Inventory **Initialization** is Administration-only and always creates a
   new `Inventory` row — never an update/merge of an existing one.
7. **Distribution** and **Trash** are available only to `STORE`, `LAB`,
   `WARD`, and `PHARMACY` categories, and only against `Inventory` rows
   belonging to the authenticated user's own location.
8. Distribution is not a transfer — it never creates or increases inventory
   anywhere else.
9. Administration users cannot Distribute or Trash. Operational users
   cannot Initialize, and cannot create locations, users, or products.
10. Backend authorization is mandatory and independent of the frontend.
    Every rule above must be enforced server-side; hidden frontend buttons
    are a usability convenience only, never the security boundary.
11. Passwords are hashed with bcrypt and must never be returned in any API
    response, under any field name.
12. Administrative bootstrap credentials come only from environment
    variables and are never hard-coded in source.
13. Locations, users, and products are never hard-deleted through the API —
    lifecycle ends via an `isActive` deactivation, preserving operational
    history.

## Database Implementation Notes

- The Administration Office singleton (rule #2) is enforced at **two**
  independent layers: a partial unique index,
  `CREATE UNIQUE INDEX ... ON "Location"("category") WHERE ("category" = 'ADMINISTRATION')`,
  guarantees at the database level that at most one `Location` row can ever
  have `category = ADMINISTRATION` — while leaving every other category
  completely unrestricted (multiple `STORE`/`LAB`/`WARD`/`PHARMACY`
  locations remain fully valid, since a partial index only applies to rows
  matching its `WHERE` clause). The seed script (`prisma/seed.ts`) is the
  second layer: it searches for a location matching both the configured
  name and `ADMINISTRATION` category before creating one, making bootstrap
  idempotent. Neither layer replaces the other — the index is the
  last-resort guarantee, the application check is what makes repeated
  bootstrap runs a no-op instead of an error.
- `Inventory.quantity` has a database `CHECK (quantity >= 0)` constraint,
  added by hand in the migration SQL (the Prisma schema DSL has no
  first-class syntax for arbitrary CHECK constraints). This is a safety
  net, **not** the primary guard: the primary guard is the service-layer
  conditional update (`WHERE quantity >= requestedQuantity` on the
  Distribute/Trash decrement) that prevents the race condition described
  in the Phase 1 architecture doc. Both layers matter — the service layer
  produces correct, race-free business behavior; the constraint protects
  against any future code path that bypasses it.
- Foreign keys (`User.locationId`, `Inventory.productId`,
  `Inventory.locationId`) use `ON DELETE RESTRICT`. The database will
  refuse to hard-delete a Location/Product that is still referenced,
  reinforcing rule #13 even though the API never issues a hard delete in
  the first place.

## Backend Foundation Conventions (Phase 4)

- **Every** endpoint returns `{ success, message, data }` on success or
  `{ success, message, error: { code, details? } }` on failure — never a
  bare object, never a different shape per module. `code` is one of the
  constants in `src/shared/errors/error-codes.ts`; add new error types as
  `AppError` subclasses there, not as ad hoc `res.status(...).json(...)`
  calls in a controller.
- `req.user` is set **only** by `authenticateRequest`
  (`src/middlewares/authenticate.ts`), sourced only from a verified JWT's
  claims. No controller, service, or middleware may set or trust a
  different source for a user's identity/location.
- `requireAdministrationAccess` / `requireOperationalLocationAccess`
  (`src/middlewares/authorize.ts`) are the coarse, route-level gate.
  Per-resource ownership checks (e.g. "this Inventory row belongs to
  `req.user.locationId`") belong in that module's service layer, not here —
  do not try to make the route-level middleware resource-aware.
- `req.query` cannot be reassigned or mutated in Express 5 — it has no
  setter and is re-parsed fresh from the URL on every access.
  `validateRequest()`'s query schema output is exposed as
  `req.validatedQuery` instead; read that, not `req.query`, in any
  controller behind a query schema.
- The JWT payload is exactly `{ userId, locationId, locationCategory }`
  (`AuthenticatedUser` in `src/shared/types/auth.ts`). Never add
  `password`, `passwordHash`, or other personal data to it.
- `prisma/seed.ts` intentionally does not import `src/config` — it is a
  standalone process with its own minimal env validation, separate from the
  Express app's runtime config.

## Engineering Conventions

- Files and folders: kebab-case (`inventory-service.ts`, `location-management/`).
- Variables and functions: camelCase, functions prefixed with an action verb
  (`createLocation()`, `initializeInventory()`, `distributeInventory()`).
- Constants: UPPER_SNAKE_CASE.
- Types, interfaces, classes, database models: PascalCase.
- Explicit ID suffixes: `userId`, `locationId`, `productId`, `inventoryId`.
- Business logic lives in **services**, never in controllers or routes.
- Controllers stay thin: read the request, call one service method, shape
  the HTTP response.
- Repositories are the only place that import the Prisma client for their
  module's models.
- Zod validates every request body/query/params **before** business logic
  runs.
- REST paths use plural resource nouns; HTTP methods express the operation
  (`POST /api/locations` creates, `GET /api/locations` lists).
- Branch names: `BIN-<issue-number>`, no descriptive suffix.
- Commit messages: `<type>: <lowercase imperative summary>` — types are
  `feat`, `fix`, `refactor`, `doc`, `chore`.

## Known, Accepted Dependency Notes

- `prisma`/`@prisma/client` are pinned to the last stable 6.x release
  (`6.19.3`), not the `latest` npm tag, which currently points to an 8.0
  release candidate requiring a driver-adapter configuration model
  incompatible with the schema style used throughout this project.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`, a
  transitive dependency of Prisma's CLI config loader (`@prisma/config`).
  This is a devDependency used only by local `prisma` CLI commands, never
  bundled into the runtime `@prisma/client`, and is not reachable through
  any code path in this application.
- The seed command is configured via the `"prisma": { "seed": ... }` key in
  `backend/package.json`, which Prisma 6 warns is deprecated in favor of
  `prisma.config.ts` (the Prisma 7 mechanism). Left as-is deliberately,
  consistent with the decision to stay on the stable Prisma 6.x line rather
  than adopt Prisma 7's driver-adapter configuration model.
