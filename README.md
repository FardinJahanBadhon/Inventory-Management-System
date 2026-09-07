# Inventory Management System

A modular, location-aware inventory management application. Administration
controls master data (locations, users, products) and initializes stock;
operational locations (Store, Lab, Ward, Pharmacy) can only view their own
inventory and reduce it through Distribution or Trash.

> **Current phase: Phase 10 — API Testing & Security Verification.**
> A 135-test integration suite (Vitest + Supertest, against a dedicated
> test database — see §18 below) now exercises every endpoint,
> authorization rule, and business invariant across all five backend
> modules, including a dedicated concurrency suite that fires genuinely
> simultaneous requests at the inventory decrement. All backend modules
> described in the source requirements now exist and are verified. See
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

## 18. Project Phases

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
- [x] Phase 10 — API Testing & Security Verification (this phase)
- [ ] Phase 11 — Frontend Foundation
- [ ] Phase 12 — Admin UI
- [ ] Phase 13 — Operational User UI
- [ ] Phase 14 — Integration
- [ ] Phase 15 — Final Quality Check
