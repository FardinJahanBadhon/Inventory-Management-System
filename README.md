# Inventory Management System

A modular, location-aware inventory management application. Administration
controls master data (locations, users, products) and initializes stock;
operational locations (Store, Lab, Ward, Pharmacy) can only view their own
inventory and reduce it through Distribution or Trash.

> **Current phase: Phase 14 — Operational UI.**
> The backend (Phases 4-10), frontend foundation (Phase 11, §18),
> authentication/session layer (Phase 12, §19), and Admin UI (Phase 13,
> §20) are all fully implemented and verified. Phase 14 adds the
> Operational interface — one Dashboard and one Inventory page (view,
> Distribute, Trash) shared by STORE, LAB, WARD, and PHARMACY alike — at
> its own `/operations/*` routes, gated to those four categories. See §21
> below. Every frontend phase (0-14) is now complete; only Phase 15 (full
> integration) and Phase 16 (final quality check) remain. See
> [PROJECT_RULES.md](PROJECT_RULES.md) for the non-negotiable business and
> engineering rules driving this build.

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Shadcn UI, Redux Toolkit, RTK Query |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL, Prisma ORM |
| Auth (Phase 5+) | JWT, bcrypt |
| Infrastructure | Docker, Docker Compose |

## 2. Repository Structure

```
inventory-management-system/
├── backend/            Express + TypeScript API (module-based)
├── frontend/           React + TypeScript + Vite SPA (module-based)
├── docker-compose.yml  PostgreSQL service with a named volume
├── .env.example        Root env vars consumed by docker-compose.yml
├── PROJECT_RULES.md     Non-negotiable business/engineering rules
└── README.md
```

Backend and frontend each have their own `.env.example` documenting the
variables specific to that app.

### Backend structure

```
backend/src/
├── app.ts                       Express app assembly (no server startup)
├── server.ts                    startup (DB connect) + graceful shutdown
├── config/
│   ├── index.ts                 Zod-validated environment configuration
│   └── constants.ts             DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
├── lib/
│   ├── prisma.ts                the one PrismaClient instance
│   ├── jwt.ts                   signAccessToken / verifyAccessToken
│   └── password.ts              hashPassword / comparePassword (bcrypt)
├── middlewares/
│   ├── authenticate.ts          authenticateRequest (JWT → req.user)
│   ├── authorize.ts             requireAdministrationAccess /
│   │                            requireOperationalLocationAccess
│   ├── validate-request.ts      Zod body/params/query validation
│   ├── not-found.ts             404 handler
│   └── error-handler.ts         centralized error → HTTP response mapping
├── routes/index.ts              mounts every module router at /api
├── shared/
│   ├── errors/                  AppError subclasses + ERROR_CODES
│   ├── types/                   AuthenticatedUser, API envelope types,
│   │                            Express Request augmentation
│   └── utils/                   logger, asyncHandler, sendSuccess,
│                                 pagination (shared by every list endpoint)
└── modules/                     each: *-routes/*-controller/*-service/
    ├── auth/                    *-repository/*-schema/*-types.ts
    ├── users/
    ├── locations/
    ├── products/
    └── inventory/
```

Every module listed above is now fully implemented — Phases 5 through 9
filled these in one at a time, each following the same layered
route → middleware → controller → service → repository → Prisma pattern.

### Frontend structure

```
frontend/src/
├── main.tsx                    StrictMode → AppProviders → App
├── App.tsx                     RouterProvider
├── app/
│   ├── store.ts                 Redux store (RTK Query reducer + auth slice)
│   ├── router.tsx                route table — see §20 (Admin) / §21 (Operational)
│   └── providers/
│       └── app-providers.tsx    composes Redux Provider (+ future providers)
├── api/
│   ├── base-api.ts               the one RTK Query instance every module
│   │                              injects endpoints into; attaches the JWT
│   │                              and handles session-expiring 401s
│   └── health-api.ts             /health check (Phase 2 verification page)
├── components/
│   ├── ui/                       Shadcn primitives: button, card, alert,
│   │                              skeleton, input, label, table, dialog,
│   │                              select, badge
│   ├── common/                   loading-spinner, page-loader, empty-state,
│   │                              error-alert, protected-route,
│   │                              management-page-header, status-badge,
│   │                              search-input, confirm-action-dialog,
│   │                              pagination-controls, summary-card
│   └── layout/                   app-shell (public layout), app-layout +
│                                  header + sidebar (authenticated layout,
│                                  session-aware since Phase 12), nav-items
│                                  (category-aware nav map, admin + operational)
├── hooks/redux-hooks.ts          useAppDispatch / useAppSelector
├── lib/
│   ├── utils.ts                   cn() — Shadcn's class-merge helper
│   └── api-error.ts               toApiError / getApiErrorMessage
├── modules/                      one directory per feature, matching the
│   ├── auth/                     backend's modules/ naming — includes
│   ├── locations/                require-administration-access.tsx and
│   ├── users/                    require-operational-access.tsx (route
│   ├── products/                 guards). dashboard/ and inventory/ each
│   ├── inventory/                hold both an admin-*/Admin* page and an
│   └── dashboard/                operational-*/Operational* page/dialogs
│                                  sharing one *-api.ts and *-types.ts.
├── pages/                        placeholder-page, not-found-page,
│                                  unauthorized-page, system-status-page
├── routes/paths.ts               ROUTES path constants
├── types/
│   ├── location-category.ts     LocationCategory (mirrors the backend enum)
│   └── pagination.ts             PaginatedData<T> (mirrors the backend's
│                                  { items, meta } list envelope)
└── vite-env.d.ts                VITE_API_BASE_URL typing
```

## 3. Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose

## 4. Environment Setup

Copy the example env files and adjust values if needed (defaults work for
local development out of the box):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env` additionally needs a real `JWT_SECRET` (left blank in the
example — the app refuses to start with a missing or short one) and an
`ADMIN_PASSWORD` for the bootstrap seed. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. Start PostgreSQL

```bash
docker compose up -d postgres
```

This starts a `postgres:16-alpine` container backed by a named volume
(`inventory-management-postgres-data`), so data survives container
recreation. Check it's healthy with:

```bash
docker compose ps
```

## 6. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 7. Set Up the Database Schema

With PostgreSQL running (step 5) and dependencies installed, from `backend/`:

```bash
# Apply migrations (creates all tables/enums/indexes/constraints)
npx prisma migrate dev

# Generate the Prisma Client (also runs automatically after migrate dev)
npm run prisma:generate

# Bootstrap the Administration Office + default admin user
npm run db:seed
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` (in `backend/.env`) control the
default admin's login credentials — set your own before seeding a
non-throwaway database. The seed is idempotent: running it again does
nothing if the Administration Office and admin user already exist.

### Verifying the database

```bash
# Confirm all migrations are applied
npx prisma migrate status

# Inspect data with Prisma's GUI
npx prisma studio

# Or query directly (container name from docker-compose.yml)
docker exec -it inventory-management-postgres psql -U postgres -d inventory_management -c "SELECT name, category, \"isActive\" FROM \"Location\";"
```

You should see exactly one `Location` row (`Administration Office`,
`ADMINISTRATION`, active) and exactly one `User` row (the default admin,
assigned to it) — no products, no inventory.

## 8. Start the Backend

```bash
cd backend
npm run dev
```

The API listens on `http://localhost:4000` by default (configurable via
`PORT` in `backend/.env`).

## 9. Start the Frontend

```bash
cd frontend
npm run dev
```

The app is served at `http://localhost:5173` and calls the backend at the
URL configured in `frontend/.env` (`VITE_API_BASE_URL`).

## 10. Health Check

With the backend and PostgreSQL both running:

```bash
curl http://localhost:4000/health
```

Expected response (every endpoint in this API uses this
`{success, message, data}` envelope — see §11):

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "service": "inventory-management-backend",
    "environment": "development",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "database": "connected"
  }
}
```

`data.database` is a live check (`SELECT 1`) — if PostgreSQL is unreachable
the endpoint still responds, but with `database: "unreachable"` and HTTP
`503` instead of `200`.

The frontend's home page also calls this endpoint through RTK Query and
displays the result — useful as a one-glance confirmation that the whole
chain (React → Redux → RTK Query → Express → Prisma → PostgreSQL) is wired
correctly.

## 11. API Response and Error Format

Every endpoint responds with one of two shapes:

```json
// success
{ "success": true, "message": "...", "data": { ... } }

// error
{ "success": false, "message": "...", "error": { "code": "NOT_FOUND" } }
```

`error.code` is one of `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR` (see
`backend/src/shared/errors/error-codes.ts`). A thrown `AppError` subclass,
a Zod validation failure, and known Prisma errors (unique constraint →
409, missing record → 404, invalid foreign key → 400) are all mapped to
this shape by the centralized error handler
(`backend/src/middlewares/error-handler.ts`); no endpoint returns a raw
stack trace or an ad hoc error shape.

## 12. Authentication

### `POST /api/auth/login` — public

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD from backend/.env>"}'
```

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "<JWT>",
    "user": {
      "id": "...",
      "username": "admin",
      "name": "System Administrator",
      "location": { "id": "...", "name": "Administration Office", "category": "ADMINISTRATION" }
    }
  }
}
```

Wrong password, unknown username, and a deactivated account all return the
same `401` with the same generic message
(`"Invalid username or password"`) — the API never reveals which one it
was.

### `GET /api/auth/me` — protected

```bash
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer <JWT>"
```

Returns the same safe user/location shape as login's `data.user`. Identity
comes only from the verified JWT — there is no way to request another
user's profile.

### How authentication works

- `backend/src/lib/jwt.ts` — `signAccessToken` / `verifyAccessToken` (JWT
  payload: `userId`, `username`, `locationId`, `locationCategory` — never a
  password or password hash)
- `backend/src/lib/password.ts` — `hashPassword` / `comparePassword` (bcrypt)
- `backend/src/middlewares/authenticate.ts` — `authenticateRequest` verifies
  a `Bearer` JWT and attaches `req.user`, sourced only from the token's
  verified claims — never from the request body, query string, or URL
- `backend/src/middlewares/authorize.ts` — `requireAdministrationAccess` /
  `requireOperationalLocationAccess`, the coarse category-based gate used
  starting with each module's own routes from Phase 6 onward
- **No token revocation / refresh system**: a JWT is valid for
  `JWT_EXPIRES_IN` (default 8h) regardless of what happens to the account
  afterward, with one exception — `GET /api/auth/me` re-reads the user from
  the database on every call and rejects the request if the account has
  since been deactivated. Other endpoints (once they exist, from Phase 6
  on) authenticate purely from the JWT and do not re-check `isActive` on
  every request; a deactivated user's access to those ends at token expiry,
  not immediately. This is a deliberate scope decision (see
  PROJECT_RULES.md), not an oversight.
- There is no `POST /api/auth/register` — users are created only by
  Administration (Phase 7).

## 13. Location Management

All endpoints require `Authorization: Bearer <JWT>` **and** an
Administration-category account — an operational user gets `403` on every
one of them, unauthenticated requests get `401`.

```
POST   /api/locations        create a location
GET    /api/locations        list locations (search, filter, paginate)
GET    /api/locations/:id    get one location
PATCH  /api/locations/:id    update name / category / isActive
```

There is no `DELETE` — locations are deactivated (`PATCH { "isActive": false }`),
never hard-deleted.

### Create

```bash
curl -X POST http://localhost:4000/api/locations \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"name":"Central Store","category":"STORE"}'
```

`category` must be one of `ADMINISTRATION`, `STORE`, `LAB`, `WARD`,
`PHARMACY` — anything else is a `422`. `isActive` defaults to `true` if
omitted.

### List, search, and filter

```bash
curl "http://localhost:4000/api/locations?search=central&category=STORE&isActive=true&page=1&pageSize=20" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

`search` matches `name` (case-insensitive, partial match). All filters
combine with AND. The response shape is
`{ success, message, data: { items: [...], meta: { page, pageSize, total, totalPages } } }`.

### The Administration Office invariant

The Location whose `category` is `ADMINISTRATION` (there is always exactly
one — enforced by a database partial unique index, see PROJECT_RULES.md)
cannot be deactivated or have its category changed away from
`ADMINISTRATION`, even as part of a larger update that also changes other
fields — the whole request is rejected (`409 Conflict`), with **no partial
effect**. Renaming it is allowed; only its `category`/`isActive` are
protected. Attempting to create a second `ADMINISTRATION`-category
location (or promote an existing one to it) is likewise rejected with
`409`.

## 14. User Management

All endpoints require `Authorization: Bearer <JWT>` **and** an
Administration-category account — same 401/403 behavior as Location
Management.

```
POST   /api/users        create a user
GET    /api/users        list users (search, filter by location/active, paginate)
GET    /api/users/:id    get one user
PATCH  /api/users/:id    update name / username / password / locationId / isActive
```

No `DELETE` — users are deactivated, never hard-deleted.

### Create

```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"name":"Store Operator","username":"store.operator","password":"StrongPassword123","locationId":"<LOCATION_ID>"}'
```

`locationId` must reference an existing location (`404` if not).
`username` must be unique (`409` if taken) and matches
`[a-zA-Z0-9._-]{3,50}`. `password` requires 8+ characters and is bcrypt-hashed
before storage — the response never includes `password` or `passwordHash`,
under any field name, on any endpoint in this module.

Sending extra fields like `"category": "ADMINISTRATION"` or `"role": "ADMIN"`
has no effect — they aren't part of the schema and are silently dropped; a
user's effective permissions always come from their assigned location's
category, never from anything in the request body.

### List, search, and filter

```bash
curl "http://localhost:4000/api/users?search=store&locationId=<LOCATION_ID>&isActive=true" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

`search` matches `name` or `username` (case-insensitive). Same
`{ items, meta }` pagination shape as Locations.

### Updating a user

`PATCH /api/users/:id` accepts any subset of `name`, `username`, `password`,
`locationId`, `isActive`. Omitting `password` leaves the existing one
unchanged. Changing `locationId` re-validates the destination location and
takes effect on the user's *next* login (an already-issued JWT keeps its
original `locationCategory` claim until it expires — see Authentication
above).

### The "at least one active administrator" invariant

If a user is currently the only active user assigned to the
`ADMINISTRATION`-category location, deactivating them or reassigning them
to a different location is rejected with `409` — the system must always
have at least one usable administrator. This check is bypassed once a
second active Administration user exists.

## 15. Product Management

All endpoints require `Authorization: Bearer <JWT>` **and** an
Administration-category account — same 401/403 behavior as Locations and
Users. Products are global master data with no location ownership at all.

```
POST   /api/products        create a product
GET    /api/products        list products (search, isActive filter, paginate)
GET    /api/products/:id    get one product
PATCH  /api/products/:id    update code / name / unit / isActive
```

No `DELETE` — products are deactivated, never hard-deleted (a deactivated
product's historical `Inventory` references must remain valid).

### Create

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"code":"SKU-001","name":"Paracetamol 500mg","unit":"box"}'
```

`code` must be unique (`409` if taken). Unlike Location/User creation,
`isActive` is **not** an accepted field here — every new product starts
active; use `PATCH` afterward if it needs to be deactivated immediately.
Any client-sent `id`, `isActive`, `createdAt`, or `updatedAt` is ignored —
the server controls all four.

### List, search, and filter

```bash
curl "http://localhost:4000/api/products?search=paracetamol&isActive=true" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

`search` matches `code` or `name` (case-insensitive). Same
`{ items, meta }` pagination shape as Locations/Users. Deactivated products
are never hidden by default — they only disappear from the results when
`isActive=true` is explicitly passed.

## 16. Inventory Management

Every endpoint requires `Authorization: Bearer <JWT>`; authorization then
differs per endpoint (see the matrix below) rather than being one blanket
rule for the whole module, unlike Locations/Users/Products.

```
GET    /api/inventory              any authenticated user (scope differs — see below)
POST   /api/inventory/initialize   Administration only
POST   /api/inventory/:id/distribute   operational categories only (Store/Lab/Ward/Pharmacy)
POST   /api/inventory/:id/trash        operational categories only
```

| Capability | Administration | Store / Lab / Ward / Pharmacy |
|---|---|---|
| View own location's inventory | ✅ | ✅ |
| View another location's inventory | ✅ (any) | ❌ |
| Initialize inventory | ✅ | ❌ (`403`) |
| Distribute / Trash | ❌ (`403`) | ✅ (own location only) |

### View inventory

```bash
curl "http://localhost:4000/api/inventory?locationId=<id>&productId=<id>" \
  -H "Authorization: Bearer <JWT>"
```

Administration may filter by `locationId` and/or `productId` to see any
location's stock. **Every other category is always scoped to their own
location** — a `locationId` they send is validated for shape but then
silently overridden, never rejected as an error; they simply always see
their own inventory no matter what they ask for. `productId` remains a
usable filter for everyone. Each row includes embedded `product` and
`location` context so the client never needs a second lookup.

### Initialize (Administration only)

```bash
curl -X POST http://localhost:4000/api/inventory/initialize \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","locationId":"<LOCATION_ID>","quantity":100}'
```

Both `productId` and `locationId` must reference existing records (`404`
otherwise); `quantity` must be a positive integer (`422` otherwise).
**This always creates a new Inventory row** — initializing the same
product at the same location twice produces two separate rows, never a
merged total (Product+Location is deliberately not unique; see
PROJECT_RULES.md). There is no restriction requiring the product or
destination location to be active.

### Distribute / Trash (operational categories only)

```bash
curl -X POST http://localhost:4000/api/inventory/<INVENTORY_ID>/distribute \
  -H "Authorization: Bearer <OPERATIONAL_JWT>" -H "Content-Type: application/json" \
  -d '{"quantity":10}'
```

Same request shape for `.../trash`. Both:
- reject Administration callers (`403`);
- reject an inventory id that doesn't belong to the caller's own location
  (`403`) — any `locationId` in the request body is ignored entirely, there
  is no code path that reads it for ownership;
- reject a `quantity` that isn't a positive integer (`422`), or that
  exceeds the row's current quantity (`400`);
- decrement the row in place — **neither operation ever creates a second
  row or deletes the original one**, even when the resulting quantity
  reaches `0`.

### Concurrency safety

Distribute and Trash share one atomic update in
`inventory-repository.ts`:

```sql
UPDATE "Inventory"
SET quantity = quantity - :requestedQuantity
WHERE id = :inventoryId
  AND "locationId" = :callerLocationId
  AND quantity >= :requestedQuantity
```

The sufficiency check and the decrement happen as a single database
statement, so two simultaneous requests against the same row can't both
succeed past the available quantity — whichever commits second
re-evaluates `quantity >= requestedQuantity` against the already-updated
value. Verified directly: firing two concurrent 70+50 (and separately
20+20) distribute requests against the same row always produced exactly
one success and one clean `400`, with the final quantity always correct
and never negative.

## 17. Testing

Backend integration tests use **Vitest** + **Supertest** against the real
Express app (bound directly, no `app.listen()`) and a real, dedicated
PostgreSQL test database — no mocked business logic.

### One-time setup

Create the test database (a second database inside the same local Postgres
container used for development — never the dev database itself) and apply
migrations to it:

```bash
docker exec -it inventory-management-postgres psql -U postgres -c "CREATE DATABASE inventory_management_test;"
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventory_management_test" npx prisma migrate deploy
```

`backend/.env.test` is already committed with matching, non-sensitive test
values (a fake JWT secret, a low bcrypt cost for speed, test admin
credentials) — nothing in it is a real secret, and it only ever points at
the local test database above.

### Running tests

```bash
cd backend
npm test           # run the full suite once
npm run test:watch # re-run on file changes
```

Every single test — not just every file — starts from an identical,
deterministic state (one Administration Office, one admin user, nothing
else): a global `beforeEach` truncates every table and re-bootstraps
before each test runs, so no test depends on data left behind by another
or on manually-created records.

### Test suite layout

```
backend/tests/
├── setup.ts                          env loading + per-test DB reset
├── helpers/
│   ├── bootstrap.ts                  reset/seed logic (test-only)
│   └── test-client.ts                supertest wrapper + fixture helpers
└── integration/
    ├── auth.test.ts                  login, /me, JWT edge cases
    ├── locations.test.ts             CRUD + Administration Office invariant
    ├── users.test.ts                 CRUD + last-active-admin invariant
    ├── products.test.ts              CRUD + code uniqueness
    ├── inventory.test.ts             view/initialize/distribute/trash + ownership
    ├── inventory-concurrency.test.ts atomic decrement under real races
    ├── security.test.ts              cross-cutting privilege-escalation attempts
    └── regression.test.ts            bootstrap idempotency + full E2E scenario
```

Run one file directly with `npx vitest run tests/integration/inventory.test.ts`.

### A note on test database safety

The suite refuses to run its destructive per-test reset against anything
that doesn't look like `inventory_management_test` — a hard runtime check
in `tests/helpers/bootstrap.ts`, independent of environment-loading order.
This exists because of a real incident during this phase's development
(a hoisted import caused the dev database to be wiped before the fix was
in place — see PROJECT_RULES.md for the full account and the two-part
fix). If you ever see this guard throw, **do not bypass it** — it means
`DATABASE_URL` resolved to something other than the test database, and
running anyway would delete real data.

## 18. Frontend Foundation

Phase 11 builds the scaffolding every later frontend phase (Auth UI, Admin
UI, Operational UI, Integration) plugs into. No business screens exist yet
— every route below renders a placeholder page purely to prove the
plumbing works end to end.

### Redux Toolkit + RTK Query

`app/store.ts` wires up one Redux store containing only the RTK Query
reducer/middleware so far — no business-domain slices exist yet (locations,
users, products, and inventory state are introduced alongside their own
modules). Typed `useAppDispatch`/`useAppSelector` hooks live in
`hooks/redux-hooks.ts`. `api/base-api.ts` is the single `createApi()`
instance for the whole app; every future feature module injects endpoints
into it (`baseApi.injectEndpoints(...)`) rather than creating a separate
API instance, so all server state shares one cache. Its `prepareHeaders`
was the integration point left for session token injection — Phase 12
(§19 below) fills it in.

### Router and layout foundation

`app/router.tsx` defines every route the application will need, each
rendering a `PlaceholderPage` for now:

```
/               system status (Phase 2 verification page)
/login          placeholder — Phase 12
/unauthorized   real page — shown when Phase 12 rejects a route
/dashboard      } placeholder — these six share the authenticated
/locations      } app-layout.tsx shell (header + sidebar)
/users          }
/products       }
/inventory      }
/profile        }
*               real Not Found page
```

`components/common/protected-route.tsx` defines the generic
route-guard mechanism (`<ProtectedRoute isAllowed={...} />` as a layout
route) without wiring it to a real value — Phase 11 deliberately avoided
faking `isAllowed={true}` before a session existed to compute it from (see
PROJECT_RULES.md's stance on frontend authorization being usability-only,
never the security boundary). Phase 12 (§19 below) supplies that real
value.

### Category-aware navigation

`components/layout/nav-items.ts` defines the nav map and
`getVisibleNavItems(category, items)`, which filters it down to what a
given `LocationCategory` (`types/location-category.ts`, mirroring the
backend's five-value enum exactly) should see. `app-layout.tsx`'s sidebar
rendered the full, unfiltered list at the end of Phase 11 because no
authenticated category existed yet to filter by; Phase 12 (§19 below)
supplies the real session category.

### Reusable states

`lib/api-error.ts`'s `toApiError`/`getApiErrorMessage` normalize anything
RTK Query can return from a failed query (HTTP error responses using the
backend's `{ success, message, error }` envelope, `FETCH_ERROR`,
`TIMEOUT_ERROR`, or a thrown `SerializedError`) into one `ApiError` shape,
so components never parse the raw union themselves.
`components/common/error-alert.tsx` renders that message.
`components/common/loading-spinner.tsx` / `page-loader.tsx` and
`components/ui/skeleton.tsx` cover loading states;
`components/common/empty-state.tsx` covers empty lists. All are generic —
no module-specific copy is hard-coded into any of them.

### Frontend scripts

```bash
cd frontend
npm run dev         # Vite dev server (http://localhost:5173)
npm run build        # tsc -b && vite build (production bundle in dist/)
npm run typecheck    # tsc -b only
npm run lint         # eslint .
```

## 19. Authentication UI & Session Management

Phase 12 fills in the integration points Phase 11 left open. All
auth-specific code lives in `frontend/src/modules/auth/` (matching the
backend's `modules/` naming — see PROJECT_RULES.md).

### Login

`/login` (`modules/auth/login-page.tsx`) posts `{ username, password }` to
`POST /api/auth/login` — never a `locationId`, `category`, or any
authorization field; the server alone determines identity and location.
Empty-field validation is inline and client-side only (usability, not a
business rule). A failed login (wrong credentials, unknown username, or a
deactivated account — all indistinguishable by design, see §12) surfaces
the backend's own message via `getApiErrorMessage()` rather than a
frontend-invented one. On success, the response's `accessToken` is stored
(`modules/auth/auth-storage.ts`, the only code that touches
`localStorage` for it) and its `user` — the same safe
`{ id, username, name, location: { id, name, category } }` shape
`GET /api/auth/me` returns — populates the Redux `auth` slice
(`modules/auth/auth-slice.ts`) directly, without a redundant follow-up
`/me` call.

### Session restoration

`modules/auth/auth-initializer.tsx` runs once at startup, wrapping
`<RouterProvider>` in `App.tsx`. If a token is stored, it calls
`GET /api/auth/me` — the authoritative source, never a client-side JWT
decode — and restores the session on success or discards the token on
any failure (expired/invalid token, or a network/server error alike, so
the app never gets stuck initializing). `isInitializing` in the auth slice
starts `true` and is not set to `false` until this resolves; every route
guard checks it before rendering or redirecting, so there is no
login-page flash on a page a valid session should already pass through.

### Route protection

- `modules/auth/require-auth.tsx` — wraps the six authenticated routes
  (`/dashboard`, `/locations`, `/users`, `/products`, `/inventory`,
  `/profile`). Shows a `PageLoader` while `isInitializing`, otherwise
  delegates to Phase 11's `<ProtectedRoute isAllowed={isAuthenticated} />`.
- `modules/auth/redirect-if-authenticated.tsx` — wraps `/login`. An
  already-authenticated visitor is sent to `/dashboard` instead of seeing
  the form again; an unauthenticated one sees it normally. No redirect
  loop: each guard only redirects in one direction.
- Category-based route restriction (e.g. blocking a non-Administration
  user from `/locations`) is **not** implemented — Phase 12 only
  distinguishes authenticated from unauthenticated. `app-layout.tsx`'s
  sidebar does filter by category (`getVisibleNavItems`), but that is a
  navigation convenience, not enforcement; the backend remains the only
  authorization boundary either way.

### Token attachment and session expiry

`api/base-api.ts`'s `prepareHeaders` reads the stored token and sets
`Authorization: Bearer <token>` on every request — centralized once, not
duplicated per endpoint. A wrapping `baseQueryWithReauth` inspects every
response: a `401` from any endpoint **other than** `/auth/login` (a wrong
password there is an expected, inline-handled outcome, not a session
expiry) clears the stored token and the auth slice in one place. The
route guards above react to the resulting `isAuthenticated: false`
automatically — this layer changes state, it never navigates directly.

### Logout

The header's "Log out" button (session-aware since this phase) calls
`useAuth().logout()` (`modules/auth/use-auth.ts`), which clears the stored
token, clears the auth slice, and resets the entire RTK Query cache
(`baseApi.util.resetApiState()`) so no authenticated data can leak into
the next session opened in the same browser. There is no server-side
logout endpoint — a JWT issued before logout remains cryptographically
valid until its natural `JWT_EXPIRES_IN` expiry (see §12); logout is a
client-side session teardown only, consistent with the backend's existing
no-revocation design.

### `useAuth()`

`modules/auth/use-auth.ts` is the one place components read session state
from: `{ user, isAuthenticated, isInitializing, locationId,
locationCategory, logout }`, backed by the Redux `auth` slice — no
component reads `localStorage` or decodes a JWT directly.

## 20. Admin UI

Phase 13 implements the full Administration-facing interface on the
foundation Phases 11-12 built. All of it lives in
`frontend/src/modules/{dashboard,locations,users,products,inventory}/`.

### Route protection

Every Admin route is nested inside both guards:
`RequireAuth` (Phase 12 — redirects an unauthenticated visitor to
`/login`) and, one level deeper, `modules/auth/require-administration-access.tsx`
(new this phase — redirects an authenticated
non-`ADMINISTRATION` user to `/unauthorized`). `/profile` sits inside only
`RequireAuth`, since it isn't part of the Administration UI and will
eventually be reachable by every category. This is a usability layer
only: every underlying API call is independently re-checked by the
backend's own `requireAdministrationAccess` middleware (§12-16 above)
regardless of what the frontend shows or hides — verified directly (see
Manual verification below) by calling `/api/locations` with a STORE
user's token and getting `403` even though the UI never exposes a path to
that call.

```
/dashboard    Admin Dashboard (summary counts)
/locations    Location Management
/users        User Management
/products     Product Management
/inventory    Inventory viewing + Initialization
```

The sidebar (`components/layout/nav-items.ts`) only lists these five for
`ADMINISTRATION`. Phase 14 gave the four operational categories their own
Dashboard/Inventory at separate `/operations/*` routes (§21 below) rather
than reopening these same five — the Admin and Operational Inventory
pages differ enough in capability (cross-location view + Initialize vs.
own-location-only + Distribute/Trash) that one URL branching on category
would have been more confusing than two symmetric, guarded route groups.

### Admin Dashboard

`modules/dashboard/admin-dashboard-page.tsx` shows the current user's
name/location/category (from `useAuth()`) and four counts — Locations,
Users, Products, Inventory records — each read from that resource's own
list endpoint called with `pageSize: 1` and its `meta.total`, rather than
a dedicated stats endpoint (the backend has none, and inventing one was
out of scope). "Inventory records" is a row count, not a summed quantity —
consistent with Product + Location not being unique.

### Location / User / Product Management

All three follow one consistent pattern: `ManagementPageHeader` (title +
"New …" button) → search/filter controls → a `Table` with
loading/empty/error states → `PaginationControls`. Create and edit share
one dialog per resource (`*-form-dialog.tsx`), remounted via a `key` on
every open so its fields always start from that row's current values (or
blank, for create) without a state-reset `useEffect`.

- **Locations** — search by name, filter by category/status. The
  Administration Office row shows no Deactivate button, and its edit
  dialog disables the category select and the active checkbox (with an
  explanatory note) — a pure rename is still allowed. This mirrors, not
  replaces, the backend's own rejection of those changes (§13 above).
- **Users** — search by name/username, filter by location/status.
  Location is a picker (populated from the Locations API), never free
  text — the backend alone derives the created/updated user's category
  from it; there is no role or category field anywhere in this form.
  Password is optional on edit (blank leaves it unchanged) and is never
  rendered anywhere in the UI. Deactivating the last active Administration
  user still correctly surfaces the backend's `409` (§14 above) rather
  than silently succeeding or being blocked client-side.
- **Products** — search by code/name, filter by status. `isActive` only
  appears in the edit dialog, matching `POST /api/products` not accepting
  it at all (§15 above). A duplicate `code` surfaces the backend's `409`
  inline without closing the dialog.

### Inventory

`modules/inventory/admin-inventory-page.tsx` (named that once Phase 14
added its `operational-inventory-page.tsx` sibling — see §21) lists
individual `InventoryRecord` rows — filterable by location/product only
(the only filters `GET /api/inventory` supports; there is no search
param) — and never aggregates same-product-same-location rows into one.
"Initialize inventory" opens `initialize-inventory-dialog.tsx`
(destination location + product pickers, quantity), which deliberately
does **not** close itself or clear the location/product choice after a
successful submission — only the quantity — since initializing the same
pair again is expected, valid, and produces a second, separate row
(verified directly: two consecutive initializations of the same
product+location produced two rows summing correctly, never a merge).
Distribution and Trash are not offered anywhere in this UI — those remain
exclusively operational actions (§21 below).

### Manual verification

All of the following were driven end-to-end in a real (headless Chromium)
browser against the running dev servers: Admin login → dashboard counts;
create/search/edit a Location; the Administration Office's locked
category/active controls; create/edit a User and confirm password never
renders; create a Product and get a clean inline error on a duplicate
code; initialize the same product+location twice and confirm two
separate rows; log in as the newly-created STORE user and get redirected
to `/unauthorized` from both `/dashboard` and `/locations`; confirm the
backend independently returns `403` for that same user calling
`/api/locations` directly; and, with a corrupted token, confirm an Admin
page redirects to `/login` and clears the stored token (Phase 12's
session-expiry handling, unmodified by this phase).

## 21. Operational UI

Phase 14 implements the interface for STORE, LAB, WARD, and PHARMACY
users — one shared implementation, not four category-specific ones. It
lives alongside the Admin UI's code in the same
`modules/{dashboard,inventory}/` directories.

### Route protection

Mirrors the Admin UI's guard pattern exactly, at its own routes:
`RequireAuth` → `modules/auth/require-operational-access.tsx` (new this
phase — allows exactly `STORE`/`LAB`/`WARD`/`PHARMACY`, redirects
`ADMINISTRATION` and anyone else to `/unauthorized`) → `AppLayout`.

```
/operations/dashboard    Operational Dashboard (own location + record count)
/operations/inventory    Own-location inventory, Distribute, Trash
```

These are deliberately separate URLs from the Admin `/dashboard` and
`/inventory` (§20 above) rather than the same routes branching on
category — the two pages differ enough in capability that a shared URL
would need an internal role-switch anyway, and a distinct route per
audience keeps both guards simple, symmetric, and independently testable.
`getVisibleNavItems()` (`components/layout/nav-items.ts`) shows exactly
two links — Dashboard, Inventory — to the four operational categories,
and the original five Admin links to none of them. As with the Admin UI,
this is a usability layer only: every Distribute/Trash/view call is
independently re-checked by the backend's own
`requireOperationalLocationAccess` middleware and the ownership check
inside `inventory-service.ts` (§16 above) regardless of what the frontend
shows — verified directly (see Manual verification below).

### One component for four categories

`operational-inventory-page.tsx` and `operational-dashboard-page.tsx`
take no category-specific branch anywhere — both simply read
`useAuth().locationCategory`/`.user.location` for display and never pass
a `locationId` to any query. `GET /api/inventory` already forces the
scope to the caller's own location for every non-`ADMINISTRATION`
category (§16 above), so "my location's inventory" is just "inventory,"
unfiltered by location, from an operational token. There is no
`StoreInventoryPage`/`LabInventoryPage`/etc., and none was needed.

### A defect this phase's own testing caught

`GET /api/products` is Administration-only (§15 above) — the operational
Inventory page's product-filter dropdown cannot populate itself from that
endpoint the way the Admin Inventory page does; an operational caller
gets a `403`. The fix: `operational-inventory-page.tsx` derives its
filter options from a second, larger `GET /api/inventory` call instead
(an endpoint operational users can call) and reads the distinct
`product` values already embedded in those records — no new backend
endpoint, no Products call from an operational context. This was caught
by the phase's own end-to-end verification (an empty dropdown with only
"All products"), not by inspection beforehand.

### Distribution

`distribute-inventory-dialog.tsx` takes an `InventoryRecord` (never a
location) and posts `{ quantity }` to
`POST /api/inventory/:id/distribute` — there is no source-location field
anywhere in the form or the request; the backend derives the source from
the caller's token. A single-step dialog (quantity entry, submit) — no
confirmation step, since this is the routine, frequent operational
action.

### Trash

`trash-inventory-dialog.tsx` is two steps, deliberately reusing the
Admin UI's `ConfirmActionDialog` for the second one (the same component
that backs Location/User/Product activate/deactivate): enter a quantity,
then explicitly confirm a dynamic description naming the exact product,
quantity, and location before `POST /api/inventory/:id/trash` fires.
Trash never deletes the `Inventory` row — only its `quantity` field
changes, same as Distribute (§16 above); the row remains part of
operational history even at `0`.

### Manual verification

Driven end-to-end in a real (headless Chromium) browser, for **all four**
operational categories, against freshly-created test locations/users/
inventory: login → correct redirect to `/operations/dashboard` → header
shows the right name/location/category → sidebar shows exactly Dashboard
+ Inventory, no Admin items → Inventory list shows only that location's
records → Distribute reduces a record's quantity → Trash (through its
confirmation step) reduces it further → direct navigation to `/locations`
redirects to `/unauthorized`. Separately verified with direct `fetch`
calls (bypassing the UI entirely, using a STORE session's real token):
distributing/trashing another location's (LAB's, WARD's)
`Inventory` id both return `403`; sending a `locationId` in a
distribute request body is silently ignored, not honored, confirmed by
checking the response's own `location.id`; and
`POST /api/inventory/initialize`, `/api/locations`, `/api/users`,
`/api/products` all return `403` for an operational token. From the
Administration side: the Admin Inventory page has no Distribute/Trash
controls, and an admin session visiting `/operations/dashboard` or
`/operations/inventory` — or calling `/distribute` directly — is rejected
exactly like an operational session is rejected from the Admin routes.
An invalid/expired token on an operational route triggers the same
Phase 12 session-expiry handling (clear token, clear session, redirect to
`/login`) already verified for the Admin UI — nothing operational-specific
was added to that mechanism.

## 22. Project Phases

This project is being built incrementally. Completed so far:

- [x] Phase 0 — Requirements Analysis
- [x] Phase 1 — Architecture & Technical Design
- [x] Phase 2 — Project Initialization
- [x] Phase 3 — Database Implementation
- [x] Phase 4 — Backend Foundation
- [x] Phase 5 — Authentication
- [x] Phase 6 — Location Management
- [x] Phase 7 — User Management
- [x] Phase 8 — Product Management
- [x] Phase 9 — Inventory Management
- [x] Phase 10 — API Testing & Security Verification
- [x] Phase 11 — Frontend Foundation
- [x] Phase 12 — Authentication UI & Session Management
- [x] Phase 13 — Admin UI
- [x] Phase 14 — Operational User UI (this phase)
- [ ] Phase 15 — Integration
- [ ] Phase 16 — Final Quality Check
