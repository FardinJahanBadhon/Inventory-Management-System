import { UnauthorizedError } from "../../shared/errors/app-error";
import { comparePassword } from "../../lib/password";
import { signAccessToken } from "../../lib/jwt";
import type { AuthenticatedUser } from "../../shared/types/auth";
import {
  findUserByIdWithLocation,
  findUserByUsernameWithLocation,
} from "./auth-repository";
import type { LoginInput } from "./auth-schema";
import type { LoginResult, SafeUserProfile } from "./auth-types";

// One generic message for every way a login attempt can fail — unknown
// username, wrong password, or a deactivated account all return exactly
// this, with the same 401 status, so a caller can never distinguish "this
// username doesn't exist" from "this password is wrong" from "this account
// is disabled."
const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password";

export async function loginWithCredentials(input: LoginInput): Promise<LoginResult> {
  const user = await findUserByUsernameWithLocation(input.username);

  if (!user) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  if (!user.isActive) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  // Location identity comes entirely from the row just loaded from the
  // database — never from anything the client sent — and this is the only
  // place in the system that is allowed to mint that trust by signing it
  // into a token.
  const authenticatedUser: AuthenticatedUser = {
    userId: user.id,
    username: user.username,
    locationId: user.location.id,
    locationCategory: user.location.category,
  };

  const accessToken = signAccessToken(authenticatedUser);

  return {
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      location: {
        id: user.location.id,
        name: user.location.name,
        category: user.location.category,
      },
    },
  };
}

// Re-reads the user from the database rather than trusting the JWT claims
// verbatim, for two reasons: (1) it reflects a name/location-name change
// made since the token was issued, and (2) it re-checks `isActive` live, so
// a user deactivated mid-session is rejected the moment they call /me
// instead of remaining usable until their token's natural expiry.
//
// This is a deliberate, narrow trade-off, not full token revocation: this
// re-check happens here, in the /me path, not inside `authenticateRequest`
// itself — every OTHER protected endpoint added from Phase 6 onward still
// authenticates purely from the JWT and does not re-hit the database on
// every request. A deactivated user's access to those other endpoints ends
// at token expiry (JWT_EXPIRES_IN), not immediately. See PROJECT_RULES.md.
export async function getAuthenticatedUserProfile(
  authenticatedUser: AuthenticatedUser,
): Promise<SafeUserProfile> {
  const user = await findUserByIdWithLocation(authenticatedUser.userId);

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Your session is no longer valid");
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    location: {
      id: user.location.id,
      name: user.location.name,
      category: user.location.category,
    },
  };
}
