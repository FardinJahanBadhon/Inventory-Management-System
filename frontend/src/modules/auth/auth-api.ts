import { baseApi } from "@/api/base-api";
import type { AuthenticatedUserProfile, LoginCredentials, LoginResult } from "./auth-types";

// Matches backend/src/shared/types/api.ts's ApiSuccessResponse<T> — every
// endpoint wraps its payload in { success, message, data }.
interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

// Injected into the one shared baseApi instance (established in Phase 11)
// rather than a separate createApi() — see PROJECT_RULES.md.
const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResult, LoginCredentials>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      transformResponse: (response: ApiSuccessResponse<LoginResult>) => response.data,
    }),
    getCurrentUser: builder.query<AuthenticatedUserProfile, void>({
      query: () => "/auth/me",
      transformResponse: (response: ApiSuccessResponse<AuthenticatedUserProfile>) => response.data,
    }),
  }),
});

export const { useLoginMutation, useGetCurrentUserQuery } = authApi;
