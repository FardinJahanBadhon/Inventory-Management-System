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
- The JWT payload is exactly `{ userId, username, locationId, locationCategory }`
  (`AuthenticatedUser` in `src/shared/types/auth.ts`). Never add
  `password`, `passwordHash`, or other personal data to it.
- `prisma/seed.ts` intentionally does not import `src/config` — it is a
  standalone process with its own minimal env validation, separate from the
  Express app's runtime config.

## Authentication Conventions (Phase 5)

- Login (`auth-service.ts`) returns the exact same error (generic message,
  401, `UNAUTHORIZED`) whether the username doesn't exist, the password is
  wrong, or the account is deactivated. Never add a more specific message
  for any of these three cases — that would let a caller enumerate valid
  usernames or account states.
- **No token revocation system exists.** A JWT remains valid for
  `JWT_EXPIRES_IN` regardless of what happens to the account afterward,
  with one deliberate exception: `GET /api/auth/me` re-reads the user from
  the database on every call (via `getAuthenticatedUserProfile`) and
  rejects the request if the account has been deactivated since the token
  was issued. This re-check lives in that one service function, **not**
  inside `authenticateRequest` — every other protected endpoint (Phase 6
  onward) authenticates purely from the JWT's claims and does not hit the
  database on every request. Do not silently add a global re-check into
  `authenticateRequest` — that changes the performance/architecture
  trade-off for every future module and should be a deliberate decision if
  ever revisited, not an incidental one.
- `modules/auth/auth-repository.ts` is a narrow, auth-scoped data-access
  file (`findUserByUsernameWithLocation`, `findUserByIdWithLocation`) — it
  exists because the Users module (Phase 7) doesn't yet have its own
  repository to reuse. When Phase 7 builds `modules/users/user-repository.ts`,
  reconsider whether auth should import from there instead of keeping its
  own copy; don't let both grow independently by accident.
- Only `findUserByUsernameWithLocation` (used by login) ever selects
  `passwordHash`. `findUserByIdWithLocation` (used by `/me`) never does —
  session/profile reads have no reason to touch the hash at all.

## Location Management Conventions (Phase 6)

- The Administration Office invariant is enforced by **checking `category`,
  not `name`**: whichever `Location` currently has
  `category = ADMINISTRATION` is, by construction, the Administration
  Office (the database's partial unique index guarantees at most one such
  row exists — see the Database Implementation Notes above). An update is
  rejected if it would set that row's `isActive` to `false` or change its
  `category` away from `ADMINISTRATION`, regardless of what else is in the
  same request — a combined "rename + deactivate" request is rejected in
  full, with **no partial effect**, verified during Phase 6 testing.
- **A pure rename of the Administration Office is allowed.** Its `name`
  has no bearing on the invariant ("one active ADMINISTRATION location
  exists") — only `category` and `isActive` do. Do not add a name-lock on
  this row; it isn't required by the source specification and isn't needed
  to preserve the invariant.
- `Location.name` is **not unique** — the Phase 3 schema has no such
  constraint, and Phase 6 preserves that; duplicate location names are
  valid. Do not add a uniqueness rule for it without a genuine requirement.
- Promoting a non-Administration location to `category: ADMINISTRATION`
  (via `PATCH`) is subject to the same singleton check as creating one —
  both paths call `assertNoExistingAdministrationLocation()` in
  `location-service.ts` before ever reaching the database, so the failure
  is a clear `409 Conflict` rather than a raw unique-constraint error.
- There is no `DELETE /api/locations/:id`. Locations are never
  hard-deleted; lifecycle ends via `PATCH { isActive: false }` (blocked
  only for the Administration Office).
- List/filter/search endpoints share `shared/utils/pagination.ts`
  (`paginationQuerySchema`, `toSkipTake`, `buildPaginationMeta`) and the
  `PaginatedData<T>` response shape in `shared/types/api.ts` — reuse these
  for Users, Products, and Inventory listing (Phase 7 onward) rather than
  reimplementing pagination per module.

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
