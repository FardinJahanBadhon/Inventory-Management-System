import jwt from "jsonwebtoken";
import { z } from "zod";
import { LocationCategory } from "@prisma/client";
import { config } from "../config";
import type { AuthenticatedUser } from "../shared/types/auth";

// Re-validating the decoded payload's shape with Zod (rather than trusting
// a type assertion) means a token whose signature is valid but whose claims
// don't match what we expect — e.g. after a future payload shape change —
// is rejected instead of silently producing a malformed AuthenticatedUser.
const accessTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  locationId: z.string().uuid(),
  locationCategory: z.enum(LocationCategory),
});

export type AccessTokenPayload = AuthenticatedUser;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    // config.jwtExpiresIn is validated at startup to match /^\d+(ms|s|m|h|d|y)$/,
    // which is a valid `ms`-style duration string — narrower than the plain
    // `string` type env vars come in as, hence the cast.
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

// Throws jwt.JsonWebTokenError / jwt.TokenExpiredError on a bad signature or
// expiry, or a ZodError if the payload shape is unexpected. Callers (see
// src/middlewares/authenticate.ts) treat all of these as "unauthenticated."
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  return accessTokenPayloadSchema.parse(decoded);
}
