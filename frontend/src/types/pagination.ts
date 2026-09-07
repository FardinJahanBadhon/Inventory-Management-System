// Mirrors backend/src/shared/types/api.ts's PaginationMeta / PaginatedData<T>
// — the `data` shape every paginated list endpoint (Locations, Users,
// Products, Inventory) returns.
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}
