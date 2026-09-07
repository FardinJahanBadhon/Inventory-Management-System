import { baseApi } from "@/api/base-api";
import type { PaginatedData } from "@/types/pagination";
import type { CreateUserInput, GetUsersParams, UpdateUserInput, User } from "./user-types";

interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<PaginatedData<User>, GetUsersParams | void>({
      query: (params) => ({ url: "/users", params: params ?? undefined }),
      transformResponse: (response: ApiSuccessResponse<PaginatedData<User>>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((user) => ({ type: "User" as const, id: user.id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),
    createUser: builder.mutation<User, CreateUserInput>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      transformResponse: (response: ApiSuccessResponse<User>) => response.data,
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    updateUser: builder.mutation<User, { id: string; input: UpdateUserInput }>({
      query: ({ id, input }) => ({ url: `/users/${id}`, method: "PATCH", body: input }),
      transformResponse: (response: ApiSuccessResponse<User>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation } = userApi;
