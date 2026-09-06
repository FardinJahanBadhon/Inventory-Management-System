import { Router } from "express";
import { authRoutes } from "../modules/auth/auth-routes";
import { userRoutes } from "../modules/users/user-routes";
import { locationRoutes } from "../modules/locations/location-routes";
import { productRoutes } from "../modules/products/product-routes";
import { inventoryRoutes } from "../modules/inventory/inventory-routes";

// Mounted at /api in src/app.ts. Each module router is currently empty
// (see the individual *-routes.ts files) and gains real endpoints as its
// phase is implemented.
export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/locations", locationRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/inventory", inventoryRoutes);
