// Mirrors backend/src/modules/products/product-types.ts's ProductResponse
// exactly. Product is global master data — no locationId, no category, no
// quantity (that belongs to Inventory only).
export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// isActive is deliberately absent — POST /api/products doesn't accept it
// (every new product starts active; see PROJECT_RULES.md).
export interface CreateProductInput {
  code: string;
  name: string;
  unit: string;
}

export interface UpdateProductInput {
  code?: string;
  name?: string;
  unit?: string;
  isActive?: boolean;
}

export interface GetProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}
