import { baseApi } from "@/api/base-api";
import type { PaginatedData } from "@/types/pagination";
import type {
  CreateLocationInput,
  GetLocationsParams,
  Location,
  UpdateLocationInput,
} from "./location-types";

interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

const locationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query<PaginatedData<Location>, GetLocationsParams | void>({
      query: (params) => ({ url: "/locations", params: params ?? undefined }),
      transformResponse: (response: ApiSuccessResponse<PaginatedData<Location>>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((location) => ({ type: "Location" as const, id: location.id })),
              { type: "Location" as const, id: "LIST" },
            ]
          : [{ type: "Location" as const, id: "LIST" }],
    }),
    createLocation: builder.mutation<Location, CreateLocationInput>({
      query: (body) => ({ url: "/locations", method: "POST", body }),
      transformResponse: (response: ApiSuccessResponse<Location>) => response.data,
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
    updateLocation: builder.mutation<Location, { id: string; input: UpdateLocationInput }>({
      query: ({ id, input }) => ({ url: `/locations/${id}`, method: "PATCH", body: input }),
      transformResponse: (response: ApiSuccessResponse<Location>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Location", id },
        { type: "Location", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetLocationsQuery, useCreateLocationMutation, useUpdateLocationMutation } = locationApi;
