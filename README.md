# Inventory Management System

A modular, location-aware inventory management application. Administration
controls master data (locations, users, products) and initializes stock;
operational locations (Store, Lab, Ward, Pharmacy) can only view their own
inventory and reduce it through Distribution or Trash.

> **Current phase: Phase 5 — Authentication.**
> `POST /api/auth/login` and `GET /api/auth/me` are now implemented and
> enforced entirely server-side: bcrypt password verification, JWT
> issuance/verification, and location/category context sourced only from
> the database and the verified token — never from client input. Locations,
> users, products, and inventory still have no CRUD or business endpoints;
> those are implemented starting Phase 6. See [PROJECT_RULES.md](PROJECT_RULES.md)
> for the non-negotiable business and engineering rules driving this build.

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

### Backend structure (as of Phase 4)

```
backend/src/
├── app.ts                       Express app assembly (no server startup)
├── server.ts                    startup (DB connect) + graceful shutdown
├── config/index.ts              Zod-validated environment configuration
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
│   └── utils/                   logger, asyncHandler, sendSuccess
└── modules/
    ├── auth/auth-routes.ts          } each currently an empty Router —
    ├── users/user-routes.ts         } real endpoints are added as each
    ├── locations/location-routes.ts } module's phase is implemented
    ├── products/product-routes.ts   } (Phase 5 through 9)
    └── inventory/inventory-routes.ts}
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

## 13. Project Phases

This project is being built incrementally. Completed so far:

- [x] Phase 0 — Requirements Analysis
- [x] Phase 1 — Architecture & Technical Design
- [x] Phase 2 — Project Initialization
- [x] Phase 3 — Database Implementation
- [x] Phase 4 — Backend Foundation
- [x] Phase 5 — Authentication (this phase)
- [ ] Phase 6 — Location Module
- [ ] Phase 7 — User Module
- [ ] Phase 8 — Product Module
- [ ] Phase 9 — Inventory Module
- [ ] Phase 10 — API Testing
- [ ] Phase 11 — Frontend Foundation
- [ ] Phase 12 — Auth UI
- [ ] Phase 13 — Admin UI
- [ ] Phase 14 — Operational User UI
- [ ] Phase 15 — Integration
- [ ] Phase 16 — Final Quality Check
