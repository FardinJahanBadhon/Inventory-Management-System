import { baseApi } from "@/api/base-api";
import type { PaginatedData } from "@/types/pagination";
import type { CreateProductInput, GetProductsParams, Product, UpdateProductInput } from "./product-types";

interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<PaginatedData<Product>, GetProductsParams | void>({
      query: (params) => ({ url: "/products", params: params ?? undefined }),
      transformResponse: (response: ApiSuccessResponse<PaginatedData<Product>>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((product) => ({ type: "Product" as const, id: product.id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),
    createProduct: builder.mutation<Product, CreateProductInput>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      transformResponse: (response: ApiSuccessResponse<Product>) => response.data,
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    updateProduct: builder.mutation<Product, { id: string; input: UpdateProductInput }>({
      query: ({ id, input }) => ({ url: `/products/${id}`, method: "PATCH", body: input }),
      transformResponse: (response: ApiSuccessResponse<Product>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetProductsQuery, useCreateProductMutation, useUpdateProductMutation } = productApi;
