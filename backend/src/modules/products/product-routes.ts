import { Router } from "express";
import { authenticateRequest } from "../../middlewares/authenticate";
import { requireAdministrationAccess } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validate-request";
import {
  createProductSchema,
  getProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from "./product-schema";
import {
  createProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "./product-controller";

export const productRoutes = Router();

// Every product-management endpoint is Administration-only — apply once
// at the router level rather than repeating both middlewares on every route.
productRoutes.use(authenticateRequest, requireAdministrationAccess);

productRoutes.post("/", validateRequest({ body: createProductSchema }), createProduct);

productRoutes.get("/", validateRequest({ query: getProductsQuerySchema }), getProducts);

productRoutes.get(
  "/:id",
  validateRequest({ params: productIdParamSchema }),
  getProductById,
);

productRoutes.patch(
  "/:id",
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  updateProduct,
);
