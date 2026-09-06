import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Single RTK Query API instance for the whole app. Feature modules
// (auth, users, locations, products, inventory) inject their own
// endpoints into this instance via `baseApi.injectEndpoints(...)`
// rather than creating separate `createApi` instances, so all server
// state shares one cache and one set of tags.
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    // Authorization header injection (reading the JWT from the auth
    // slice) will be added here once the auth module exists in Phase 5.
  }),
  tagTypes: ["Location", "User", "Product", "Inventory"],
  endpoints: () => ({}),
});
