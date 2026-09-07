import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { getStoredAccessToken, clearStoredAccessToken } from "@/modules/auth/auth-storage";
import { clearAuthenticatedUser } from "@/modules/auth/auth-slice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = getStoredAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Login intentionally returning 401 (wrong username/password) is a normal,
// expected outcome shown inline on the login form — it must never trigger
// the "session expired" handling below, which is only for an
// already-authenticated request whose token has since gone stale.
const LOGIN_ENDPOINT_URL = "/auth/login";

// Centralizes 401 handling for every endpoint in the app (section 17): one
// stale/invalid token clears itself and the auth slice here, once, instead
// of every feature module re-checking `error.status === 401` itself. The
// route guards in modules/auth (require-auth.tsx) react to the resulting
// `isAuthenticated: false` and redirect to /login — this layer only ever
// changes state, it never navigates directly.
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const requestUrl = typeof args === "string" ? args : args.url;

  if (result.error?.status === 401 && requestUrl !== LOGIN_ENDPOINT_URL) {
    clearStoredAccessToken();
    api.dispatch(clearAuthenticatedUser());
  }

  return result;
};

// Single RTK Query API instance for the whole app. Feature modules
// (auth, users, locations, products, inventory) inject their own
// endpoints into this instance via `baseApi.injectEndpoints(...)`
// rather than creating separate `createApi` instances, so all server
// state shares one cache and one set of tags.
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Location", "User", "Product", "Inventory"],
  endpoints: () => ({}),
});
