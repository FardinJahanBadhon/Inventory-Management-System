import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendSuccess } from "../../shared/utils/response";
import * as productService from "./product-service";
import type {
  CreateProductInput,
  GetProductsQuery,
  ProductIdParam,
  UpdateProductInput,
} from "./product-schema";

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body as CreateProductInput);
  sendSuccess(res, product, "Product created successfully", 201);
});

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as GetProductsQuery;
  const result = await productService.getProducts(query);
  sendSuccess(res, result, "Products retrieved successfully");
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as ProductIdParam;
  const product = await productService.getProductById(id);
  sendSuccess(res, product, "Product retrieved successfully");
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as ProductIdParam;
  const product = await productService.updateProduct(id, req.body as UpdateProductInput);
  sendSuccess(res, product, "Product updated successfully");
});
