import { baseApi } from "@/api/base-api";
import type { PaginatedData } from "@/types/pagination";
import type {
  GetInventoryParams,
  InitializeInventoryInput,
  InventoryRecord,
  QuantityMutationInput,
} from "./inventory-types";

interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query<PaginatedData<InventoryRecord>, GetInventoryParams | void>({
      query: (params) => ({ url: "/inventory", params: params ?? undefined }),
      transformResponse: (response: ApiSuccessResponse<PaginatedData<InventoryRecord>>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((record) => ({ type: "Inventory" as const, id: record.id })),
              { type: "Inventory" as const, id: "LIST" },
            ]
          : [{ type: "Inventory" as const, id: "LIST" }],
    }),
    // Always creates a new row — never an upsert. Repeated calls with the
    // same productId/locationId are expected and valid (see
    // PROJECT_RULES.md); do not add any client-side merge/dedupe logic.
    initializeInventory: builder.mutation<InventoryRecord, InitializeInventoryInput>({
      query: (body) => ({ url: "/inventory/initialize", method: "POST", body }),
      transformResponse: (response: ApiSuccessResponse<InventoryRecord>) => response.data,
      invalidatesTags: [{ type: "Inventory", id: "LIST" }],
    }),
    // Operational-only (backend rejects ADMINISTRATION with 403). Decreases
    // the named row in place — never creates a second row, never creates
    // stock anywhere else. `id` is the Inventory record id; there is no
    // locationId field because the source is always the caller's own
    // location, enforced server-side.
    distributeInventory: builder.mutation<InventoryRecord, { id: string; input: QuantityMutationInput }>({
      query: ({ id, input }) => ({ url: `/inventory/${id}/distribute`, method: "POST", body: input }),
      transformResponse: (response: ApiSuccessResponse<InventoryRecord>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inventory", id },
        { type: "Inventory", id: "LIST" },
      ],
    }),
    trashInventory: builder.mutation<InventoryRecord, { id: string; input: QuantityMutationInput }>({
      query: ({ id, input }) => ({ url: `/inventory/${id}/trash`, method: "POST", body: input }),
      transformResponse: (response: ApiSuccessResponse<InventoryRecord>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inventory", id },
        { type: "Inventory", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useInitializeInventoryMutation,
  useDistributeInventoryMutation,
  useTrashInventoryMutation,
} = inventoryApi;
