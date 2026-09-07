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
- `modules/auth/auth-repository.ts` (`findUserByUsernameWithLocation`,
  `findUserByIdWithLocation`) stays **separate** from
  `modules/users/user-repository.ts`, by resolved decision as of Phase 7 —
  this was flagged as a "reconsider" item in Phase 5 and Phase 7's own
  instructions confirmed the answer: auth-specific queries (the one place
  allowed to select `passwordHash`, for login) should stay apart from
  public user-management queries. Do not merge them; do not let
  `user-repository.ts` grow a `passwordHash`-selecting function either.
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

## User Management Conventions (Phase 7)

- **At least one active Administration user must always exist** — this is
  the Core Rule "the system must always have an administrative user
  associated with the Administration Office," enforced in
  `user-service.ts`'s `assertAdministratorInvariantPreserved`. It mirrors
  Phase 6's Administration Office protection: whichever user is currently
  the *only* active user assigned to an `ADMINISTRATION`-category location
  cannot be deactivated, nor reassigned to a non-Administration location,
  unless another active Administration user already exists. Verified during
  Phase 7 testing (deactivation blocked with one admin, allowed with two,
  re-blocked back down to one).
- There is no "cannot deactivate yourself" rule — nothing in the source
  requirements asks for it, and the admin-invariant check above already
  covers the actual failure mode (zero administrators left). An admin can
  deactivate their own account if another active admin exists.
- Users **may** be created or reassigned to an inactive location — the
  source requirements place no restriction on this, so none was invented.
  This is a deliberate no-op decision, not an oversight.
- `username` has light, undocumented-elsewhere validation (3–50 chars,
  `[a-zA-Z0-9._-]+`) applied only at **creation/update**, not at login —
  `auth-schema.ts`'s `loginSchema` intentionally only checks
  non-empty, since it must accept whatever an account was already created
  with.
- Password changes go through `PATCH /api/users/:id { password }` only —
  there is no separate password-reset/change-password endpoint. Omitting
  `password` from a PATCH body leaves the existing hash untouched (Prisma
  treats an `undefined` field as "don't update this column").
- Username-uniqueness and location-existence are checked in the service
  before hitting the database (`assertUsernameAvailable`,
  `assertLocationExists`), for clear `409`/`404` responses — the database's
  own unique constraint on `username` and foreign key on `locationId`
  remain the final race-condition backstop, surfaced generically as `409`
  by Phase 4's Prisma-error mapping if ever actually hit.

## Product Management Conventions (Phase 8)

- **`isActive` is not accepted on `POST /api/products`** — unlike
  Location/User creation (where `isActive` is an optional client override
  defaulting to `true`), `createProductSchema` omits the field entirely and
  the repository always inserts `isActive: true`. This is a deliberate,
  per-endpoint difference, not an inconsistency: there is no real use case
  for creating a product that starts out inactive, and the requirement was
  explicit that the server alone controls `isActive`/`id`/`createdAt`/
  `updatedAt` at creation time. `isActive` remains a normal, optional field
  on `PATCH /api/products/:id`.
- Product has no singleton/invariant rule analogous to the Administration
  Office (Locations) or the last-active-admin check (Users) — deactivating
  or renaming a product has no system-wide side effect, so
  `updateProduct()` only guards code-uniqueness, nothing else.
- Product is intentionally location-agnostic: there is no `locationId` on
  Product and no location-based authorization beyond the blanket
  Administration-only gate. Do not add a `locationId`/`category` field to
  Product — location-specific quantity belongs exclusively to `Inventory`
  (Phase 9).

## Inventory Management Conventions (Phase 9)

- **The atomic conditional decrement is the entire concurrency story.**
  `inventory-repository.ts`'s `decrementInventoryQuantity` performs the
  "is there enough stock?" check and the deduction as a single
  `updateMany` whose `WHERE` clause includes both `locationId` (ownership)
  and `quantity: { gte: requestedQuantity }` (sufficiency), so there is no
  read-modify-write gap for a concurrent request to race through. Verified
  during Phase 9 testing: two simultaneous distribute requests against a
  100-unit row (70 + 50, and separately 20 + 20 against a lower balance)
  each resulted in exactly one success and one clean `400`, with the final
  quantity always correct and never negative. Do not "simplify" this back
  to a separate read-then-write — that reintroduces the exact race this
  guards against.
- **Ownership for Distribute/Trash is `Inventory.locationId === req.user.locationId`**,
  checked once in `decreaseOwnInventoryQuantity` (the shared helper behind
  both `distributeInventory()` and `trashInventory()`) via a pre-read, and
  re-enforced inside the same atomic `WHERE` clause as the quantity guard.
  A `locationId` sent in the request body is never read for this purpose —
  there is no code path that looks at it at all.
- **View scoping**: `GET /api/inventory` is open to any authenticated user,
  but `inventory-service.ts`'s `getInventory` forces the `locationId`
  filter to the caller's own location for every category except
  `ADMINISTRATION`, silently overriding (never erroring on) any
  `locationId` the client sent. Verified: an operational user sending
  another location's id, or a nonexistent one, always sees only their own
  inventory.
- **Initialization always inserts** (`inventory-repository.ts`'s
  `createInventory` only ever calls `prisma.inventory.create`, never an
  upsert or a merge-into-existing-row) — repeated initialization of the
  same product+location was verified to produce two separate rows summing
  correctly via `SUM(quantity)`, not one merged row.
- **Distribution and Trash never touch a second Inventory row.** Neither
  operation accepts or reads a destination location — the only side effect
  either can have is decrementing the one row named in the URL. This is
  structural (no destination field exists in either schema), not just a
  documented policy.
- **Trash never deletes the row.** A `Inventory` row that reaches
  `quantity: 0` (via Distribute or Trash) remains in the table — the same
  `updateProduct`-style deactivation philosophy used elsewhere, just with
  nothing to deactivate on Inventory (there is no `isActive` on it; a
  zero-quantity row is simply a row with no stock, still fully queryable).
- Neither Product nor destination Location is required to be active for
  initialization to succeed — nothing in the source requirements restricts
  this, so no such rule was invented, consistent with the same choice made
  for User↔Location assignment in Phase 7.
- `inventory-service.ts` imports `findProductById` from the Products
  module and `findLocationById` from the Locations module directly (same
  cross-module-repository-reuse pattern Phase 7's `user-service.ts`
  established for location lookups) rather than duplicating those queries.

## Testing Conventions (Phase 10)

- **Real incident, read before touching `tests/setup.ts`.** Vitest's
  module runner hoists static ES `import` statements — ALL of them
  execute, in source order, before any other top-level code in the
  importing module, regardless of where they're textually placed. During
  Phase 10 development, `tests/setup.ts` statically imported
  `src/lib/prisma`, which imports `src/config` (reads `DATABASE_URL` at
  import time) — this evaluated *before* the file's own env-override call
  ran, silently keeping `DATABASE_URL` pointed at the **development**
  database. The test suite's per-test `beforeEach` reset then wiped the
  real dev database twice before this was caught (via a diagnostic that
  queried `current_database()` through the actual Prisma client, not by
  re-reading `process.env`, which had looked correct all along).
  **Consequences of this class of bug are silent and destructive — the
  fix has two independent parts, both required:**
  1. `tests/setup.ts` loads `.env.test` with `override: true` (Vite/Vitest
     auto-loads the plain `.env` before any setupFile runs, so without
     `override: true` the dev value wins by dotenv's own
     don't-clobber-what's-set default), and imports `src/lib/prisma` /
     `tests/helpers/bootstrap` via **dynamic** `import()` (not hoisted,
     unlike static `import`) deferred into the first `beforeEach` call —
     never convert these back to static imports.
  2. `tests/helpers/bootstrap.ts`'s `assertUsingTestDatabase()` is a hard
     runtime guard, checked at the start of every destructive/data-writing
     function, that throws if the *actual resolved* `config.databaseUrl`
     doesn't contain `inventory_management_test`. This is the
     non-negotiable safety net — keep it even if the loading-order fix
     above looks solid; it is what makes a future regression here loud and
     harmless instead of silent and destructive.
- The test suite runs against a **second database inside the same local
  Postgres container** (`inventory_management_test`), never the dev
  database (`inventory_management`) — see README.md for the one-time setup
  command. `vitest.config.mts` sets `fileParallelism: false` because every
  test file shares and resets this one database; running files in
  parallel would let them stomp on each other's data.
- Every single test (not just every file) starts from an identical,
  deterministic state: `tests/setup.ts`'s global `beforeEach` calls
  `resetAndBootstrapTestDatabase()`, which deletes every row from every
  table and recreates exactly the Administration Office + one admin user —
  the same state a fresh `npm run db:seed` produces. No test may depend on
  data left behind by another.
- `tests/helpers/bootstrap.ts` exports two different functions on purpose:
  `resetAndBootstrapTestDatabase()` (wipe-then-create, for per-test
  isolation) and `ensureBootstrap()` (find-or-create, mirroring
  `prisma/seed.ts`'s actual logic) — only the latter genuinely exercises
  bootstrap idempotency. Don't use the reset variant to test idempotency;
  it always deletes first, so it can't prove find-or-create behavior.
- `tests/helpers/test-client.ts`'s `app` binds `supertest` directly to
  `createApp()` — no `server.ts`, no `app.listen()`, no real port. This
  keeps the suite from ever colliding with a dev server that happens to be
  running, and lets `Promise.all([...])` fire genuinely concurrent
  requests against the same in-process Express instance (this is how the
  concurrency tests work — see `inventory-concurrency.test.ts`).
- **Fixed during Phase 14 (discovered while re-running the suite as a
  regression check, unrelated to that phase's actual frontend work):**
  `inventory-concurrency.test.ts`'s 70+50 tests asserted the final
  quantity was always `30` (`100 - 70`), on the mistaken assumption that
  the 70-unit request always wins the race. It doesn't — 70 and 50 each
  individually fit within 100 (it's only their *sum*, 120, that doesn't),
  so whichever request's `updateMany` commits first legitimately wins,
  and the other then correctly fails as insufficient. The single-shot
  version of this test passed most of the time by luck; the "repeats
  the race 10 times" version made the same wrong assumption ~10x more
  likely to be caught out, and did intermittently fail with the true,
  equally-valid outcome (`50` remaining, i.e. the 50-unit request won).
  Both assertions now derive the expected remaining quantity from
  whichever request actually returned `200`, mirroring the pattern the
  adjacent "60+60" test already used correctly. This was a test-only
  defect — `inventory-repository.ts`'s atomic decrement itself was never
  wrong, and needed no change. Do not reintroduce a hardcoded winner
  assumption in a concurrent-race test; assert on the observed outcome.

## Frontend Foundation Conventions (Phase 11)

- **One RTK Query instance for the whole app.** `frontend/src/api/base-api.ts`
  is the only `createApi()` call; every feature module injects its own
  endpoints into it via `baseApi.injectEndpoints(...)`. Do not create a
  second `createApi()` instance for a module — that would split the cache
  and tag invalidation across two systems for no reason.
- **No fake authentication.** At the end of Phase 11, `base-api.ts`'s
  `prepareHeaders` and `components/common/protected-route.tsx` were
  integration points only, with nothing wired to a real session yet — kept
  that way deliberately rather than hard-coding `isAuthenticated = true`,
  a placeholder JWT, or a default `LocationCategory` anywhere in the
  frontend. Phase 12 (see below) is what actually reads a real session.
- `getVisibleNavItems()` (`components/layout/nav-items.ts`) returns an
  empty list for a `null` category rather than a default set of items —
  mirrors the backend rule that a category must come from a verified
  session, never be assumed client-side.
- The frontend's feature directories are named `modules/` (`auth/`,
  `users/`, `locations/`, `products/`, `inventory/`), matching the
  backend's `modules/` naming exactly — established in Phase 2 and kept
  in Phase 11 rather than renamed to `features/`.
- No business-domain Redux state exists yet (no location/user/product/
  inventory slice) — `app/store.ts` holds only the RTK Query reducer.
  Each module's own phase introduces its own state if that module actually
  needs client-side state beyond what RTK Query's cache already provides.

## Authentication UI & Session Management Conventions (Phase 12)

- **The login response's `user` is treated as equally authoritative as
  `GET /api/auth/me`'s.** Both return the exact same `SafeUserProfile`
  shape from the same backend code path. `login-page.tsx` populates the
  auth slice directly from the login response rather than issuing a
  redundant follow-up `/me` call — do not add one "just to be safe"; it
  would return identical data.
- **The stored access token, not the Redux `auth` slice, is the source of
  truth `prepareHeaders` reads from** (`modules/auth/auth-storage.ts`'s
  `getStoredAccessToken()`), not `getState()`. This was a deliberate
  choice to avoid a circular type dependency between `api/base-api.ts` and
  `app/store.ts`, and it means the header is correct even on the very
  first request fired before the Redux store has processed any action.
- **`isInitializing` never re-enters `true` after startup.** There is
  deliberately no `setAuthInitializing()` action — `isInitializing` starts
  `true` in `auth-slice.ts`'s initial state and is only ever set to
  `false`, by whichever of `setAuthenticatedUser`/`clearAuthenticatedUser`
  resolves first in `auth-initializer.tsx`. Do not add a way to flip it
  back to `true`; nothing in this app's session model re-enters an
  "unknown auth state" after the first resolution.
- **A 401 from `POST /api/auth/login` never triggers the global session-
  expiry handler.** `api/base-api.ts`'s `baseQueryWithReauth` explicitly
  excludes the `/auth/login` URL from its "clear token + clear auth slice"
  logic — a wrong password there is a normal, expected, inline-handled
  outcome (rendered via `ErrorAlert`), not a stale session. Only a 401
  from an *already-authenticated* request means the session went stale.
- **Logout is client-side only.** There is no `POST /api/auth/logout` on
  the backend (see Authentication Conventions (Phase 5) above — no
  revocation system exists) and Phase 12 does not add one. `useAuth().logout()`
  clears the local token, the auth slice, and the entire RTK Query cache
  (`baseApi.util.resetApiState()`) — it does not and cannot invalidate the
  JWT itself, which remains valid server-side until `JWT_EXPIRES_IN`.
- **`require-auth.tsx` itself stayed authentication-only, not
  category-based** — at the end of Phase 12, every route behind it was
  reachable by any authenticated user regardless of `locationCategory`.
  Category-based restriction was added in Phase 13 as a separate,
  composable guard (`require-administration-access.tsx`) layered *inside*
  `require-auth.tsx`, not by teaching `require-auth.tsx` itself about
  categories — keep that separation for any future category-specific
  guard (e.g. an eventual operational-only one in Phase 14) rather than
  growing one guard component that knows about every category.
- No `zod`/`react-hook-form` on the frontend — `modules/auth/
  auth-validation.ts` is a plain function (`validateLoginForm`), not a
  schema. `zod` is present in `node_modules` only as an undeclared
  transitive dependency of something else; it is not a project dependency
  and must not be imported directly until it's actually added to
  `frontend/package.json`.

## Admin UI Conventions (Phase 13)

- **Two new frontend dependencies, deliberately added:**
  `@radix-ui/react-dialog` and `@radix-ui/react-select`, both declared in
  `frontend/package.json` (not left as undeclared transitive deps, unlike
  `zod` — see Phase 12's note above). These are the accessible-dialog and
  accessible-select primitives Shadcn itself is built on; every management
  page needs at least one of each (create/edit forms, category/location
  pickers), and building either from scratch would either fail the
  accessibility requirements (focus trap, keyboard nav, ARIA) or duplicate
  what these libraries already solve correctly. No other new dependency
  was added — no table library, no form library, no dropdown-menu
  primitive not already justified above.
- **Category-based route restriction is `require-administration-access.tsx`,
  layered inside `require-auth.tsx`** (see the updated Phase 12 note
  above) — not a change to `require-auth.tsx` itself. `/profile` is
  intentionally outside this guard (inside `RequireAuth` only) because it
  isn't part of the Administration UI and stays reachable by every
  category — confirmed in Phase 14, which added the operational
  counterpart guard alongside this one rather than folding both into one.
- **Form dialogs reset via a `key` prop, not a `useEffect`.** Every
  `*-form-dialog.tsx` (Location/User/Product) computes its initial
  `useState` values directly from its `entity` prop and is deliberately
  given no reset effect; the calling page increments a `formKey` counter
  on every "New …"/"Edit" click and passes it as the dialog's `key`,
  forcing a fresh mount instead. This was a deliberate fix for the
  `react-hooks/set-state-in-effect` lint rule (calling `setState`
  synchronously inside an effect body) — do not reintroduce an
  open-triggered reset effect to "simplify" this back; keep the
  remount-via-key pattern for any future form dialog.
- **`InitializeInventoryDialog` never closes itself or clears its
  location/product selection after a successful submit** — only the
  quantity field. Initialization always creates a new row (Business Rule
  #6), so repeating the same destination for another product, or the same
  product again, is the expected next action, not an edge case to guard
  against. Do not add logic that prevents, warns about, or dedupes a
  repeated product+location initialization anywhere in this dialog or in
  `inventory-api.ts`.
- **The Administration Office's category/active controls are disabled in
  `location-form-dialog.tsx`'s edit mode** (detected via
  `location.category === "ADMINISTRATION"` on the row being edited, not a
  name check — consistent with the backend's own check, see Location
  Management Conventions (Phase 6) above) — a pure rename stays enabled.
  This is a UI courtesy that mirrors the backend's rejection; removing it
  would not create a security hole (the backend still rejects the change),
  but would let an admin submit a form the server is guaranteed to bounce.
- **Dashboard counts come from existing list endpoints' pagination
  metadata** (`meta.total`, fetched with `pageSize: 1`), never from a
  dedicated stats/analytics endpoint — none exists, and adding one was
  explicitly out of scope. Do not invent a backend aggregation endpoint
  for the dashboard; if a real metric can't be derived from an existing
  endpoint's response, it doesn't belong on the dashboard yet.
- **`GET /api/inventory` has no `search` parameter** — unlike
  Locations/Users/Products, `admin-inventory-page.tsx` only offers
  location/product filter selects, never a text search box. Do not add
  one to the frontend; there is nothing on the backend for it to call.
- Each of `locations/`, `users/`, `products/`, `inventory/` under
  `frontend/src/modules/` defines its own `PaginatedData<T>`-shaped query
  hook via `baseApi.injectEndpoints(...)` and its own `*-types.ts` mirroring
  its backend module's response shape exactly (no `isActive` on
  `AuthenticatedUserProfile`-style guessing; e.g. `Product` has no
  `locationId`, `InventoryRecord` is never aggregated). `types/pagination.ts`
  is the one shared type across all four (`PaginatedData<T>`) — do not
  duplicate that shape per module.

## Operational UI Conventions (Phase 14)

- **`admin-inventory-page.tsx` was renamed from `inventory-page.tsx`**
  when this phase added `operational-inventory-page.tsx` as its sibling —
  a small, deliberate rename for clarity, not a functional change (see
  Phase 13's note above, which referenced the old name; it's now
  corrected throughout this file and the README).
- **One component per screen for all four operational categories** —
  `operational-inventory-page.tsx` and `operational-dashboard-page.tsx`
  contain no `if (category === "STORE")`-style branch anywhere. Both read
  `useAuth()` only for display (name, location, category) and never pass
  a `locationId` to any query — `GET /api/inventory` already scopes an
  operational caller to their own location (Inventory Management
  Conventions (Phase 9) above). Do not add a per-category variant of
  either page; if a genuine behavioral difference between STORE/LAB/WARD/
  PHARMACY is ever required, it belongs inside these shared components as
  a `locationCategory`-keyed branch, not as a new file.
- **`GET /api/products` is Administration-only — operational pages must
  never call it.** `operational-inventory-page.tsx`'s product-filter
  dropdown deliberately does NOT use `useGetProductsQuery`
  (`modules/products/product-api.ts`); it derives its options from a
  second `useGetInventoryQuery({ pageSize: 100 })` call and reads each
  record's embedded `product` field instead. This was a real bug caught
  by this phase's own end-to-end testing (the dropdown silently rendered
  empty — a 403 the UI never surfaced as an error, since the query result
  was just treated as "no data yet"). Do not reintroduce a
  `useGetProductsQuery`/`useGetLocationsQuery` call anywhere reachable by
  an operational session — both endpoints are Administration-only for
  every method, including `GET`.
- **Distribution and Trash never send a `locationId`.** Neither
  `distribute-inventory-dialog.tsx` nor `trash-inventory-dialog.tsx` has a
  location field — the target row comes from `record.id` (already scoped
  to the caller by the time it was fetched), and the source location is
  whatever the backend derives from the caller's own JWT
  (`requireOperationalLocationAccess` + the ownership check in
  `inventory-service.ts`, Inventory Management Conventions (Phase 9)
  above). Do not add a location picker to either dialog "for
  flexibility" — there is no valid use for one, and doing so would imply
  a capability (cross-location distribution) the business rules
  explicitly forbid.
- **Trash is the only two-step operational action, reusing
  `ConfirmActionDialog`** (the same component Locations/Users/Products
  use for activate/deactivate) as its second step. Distribute stays
  single-step. Do not add a confirmation step to Distribute "for
  consistency" — it's the routine, frequent action, and the asymmetry
  with Trash is deliberate (see Phase 14's own instructions on this).
- **`/operations/dashboard` and `/operations/inventory` are separate
  routes from `/dashboard` and `/inventory`**, not the same URLs
  branching by category — see the Admin UI Conventions (Phase 13) note
  above on `require-administration-access.tsx` for the parallel
  `require-operational-access.tsx` guard. Do not collapse these into one
  route with an internal role switch; the two Inventory pages in
  particular differ enough in capability (cross-location + Initialize vs.
  own-location-only + Distribute/Trash) that a shared URL would need the
  branch anyway, with none of the benefit.
- **Post-login and already-authenticated-visiting-`/login` redirects are
  category-aware** (`login-page.tsx` and
  `redirect-if-authenticated.tsx` both branch on
  `location.category === "ADMINISTRATION"` to choose `/dashboard` vs.
  `/operations/dashboard`) — a defect from Phase 12/13 (both hardcoded
  `/dashboard`) that this phase's own regression pass caught and fixed,
  since it would have silently bounced every operational login straight
  to `/unauthorized`. Any future additional "landing page" branch (e.g. a
  fifth category) must be added to both places, not just one.
- **A pre-existing, unrelated test defect was fixed while re-running the
  full suite as this phase's regression check** — see Testing Conventions
  (Phase 10) above for `inventory-concurrency.test.ts`'s corrected
  race-winner assertions. Not a Phase 14 change in substance, but noted
  here since it's how it was found.

## Final Audit Notes (Phase 16)

- **The Sidebar was completely hidden below the `md` breakpoint from
  Phase 11 through Phase 15** (`className="hidden ... md:block"`), on the
  reasoning that a 224px-wide vertical rail has no room next to real
  content at phone width. That reasoning was correct, but the
  consequence — verified with an actual 375px-viewport screenshot during
  this phase's audit, not assumed — was that a phone-width user had **no
  way to navigate between pages at all** apart from typing a URL
  directly; every route was still reachable, but not from the UI. Fixed
  by making `Sidebar` render as a horizontally-scrollable bar below `md`
  and a normal vertical rail at `md` and up (`app-layout.tsx`'s
  container gained `flex-col md:flex-row` to match) — CSS-only, no new
  component, no dependency, and confirmed not to change anything at
  desktop width (still a fixed ~224px column). This is the only code
  defect this phase's audit found; every other check (security,
  authorization, mass assignment, dependency, database, RTK Query,
  concurrency) confirmed prior phases' work rather than uncovering
  anything new to fix.
- **`npm audit`**: backend still reports exactly the pre-existing
  `deepmerge-ts`/`@prisma/config` high-severity advisory documented in
  Known, Accepted Dependency Notes below — unchanged in nature, severity,
  or reachability since it was first documented. Frontend reports zero
  vulnerabilities. No dependency changes were made this phase.
- Nothing else in this phase changed application code — the rest of the
  effort was verification (backend test suite re-run three times
  consecutively for stability, full mass-assignment/IDOR/JWT-edge-case
  review against the actual source, mobile-viewport and keyboard-only
  accessibility checks) rather than new fixes.

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
