import { useEffect, type ReactNode } from "react";
import { useAppDispatch } from "@/hooks/redux-hooks";
import { useGetCurrentUserQuery } from "./auth-api";
import { getStoredAccessToken, clearStoredAccessToken } from "./auth-storage";
import { setAuthenticatedUser, clearAuthenticatedUser } from "./auth-slice";

// Runs once at app startup: if a token is stored, verifies it against
// GET /api/auth/me (the authoritative source for identity/location/
// category) and restores the session; otherwise the app starts
// unauthenticated. Route guards key off `isInitializing` (see
// require-auth.tsx / redirect-if-authenticated.tsx) so nothing redirects
// before this resolves.
export function AuthInitializer({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const hasStoredToken = Boolean(getStoredAccessToken());

  const { data, isError } = useGetCurrentUserQuery(undefined, { skip: !hasStoredToken });

  useEffect(() => {
    if (!hasStoredToken) {
      dispatch(clearAuthenticatedUser());
      return;
    }
    if (data) {
      dispatch(setAuthenticatedUser(data));
    } else if (isError) {
      // Covers an expired/invalid token and a network/server failure alike
      // — in every case there is no restorable session, so fall back to
      // unauthenticated rather than leaving the app stuck initializing.
      clearStoredAccessToken();
      dispatch(clearAuthenticatedUser());
    }
  }, [hasStoredToken, data, isError, dispatch]);

  return children;
}
