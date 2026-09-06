import { Router } from "express";

// Login and session endpoints (POST /api/auth/login, GET /api/auth/me) are
// implemented in Phase 5 — Authentication. This placeholder only reserves
// the module's mount point on the central router (see src/routes/index.ts)
// so /api/auth/* resolves to a real (currently empty) router today instead
// of a 404 that would later change meaning.
export const authRoutes = Router();
