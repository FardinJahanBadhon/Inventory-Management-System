import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux-hooks";
import { baseApi } from "@/api/base-api";
import { clearAuthenticatedUser } from "./auth-slice";
import { clearStoredAccessToken } from "./auth-storage";

// The one place the rest of the app reads session state from — components
// consume this instead of reaching into Redux or localStorage directly.
export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isInitializing = useAppSelector((state) => state.auth.isInitializing);

  const logout = useCallback(() => {
    clearStoredAccessToken();
    dispatch(clearAuthenticatedUser());
    // Drops every cached query result, not only auth's — later modules
    // will cache per-location/per-user data that must not leak into the
    // next session started on the same browser.
    dispatch(baseApi.util.resetApiState());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isInitializing,
    locationId: user?.location.id ?? null,
    locationCategory: user?.location.category ?? null,
    logout,
  };
}
