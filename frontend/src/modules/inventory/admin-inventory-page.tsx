import { useState } from "react";

import { ManagementPageHeader } from "@/components/common/management-page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageLoader } from "@/components/common/page-loader";
import { PaginationControls } from "@/components/common/pagination-controls";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { useGetLocationsQuery } from "@/modules/locations/location-api";
import { useGetProductsQuery } from "@/modules/products/product-api";
import { useGetInventoryQuery } from "./inventory-api";
import { InitializeInventoryDialog } from "./initialize-inventory-dialog";

// Administration view: every location, filterable by location/product (the
// only filters the backend supports for this endpoint — there is no
// search param). Distribution/Trash are not offered here — those actions
// are reserved for operational categories (see PROJECT_RULES.md) and are
// out of scope for the Admin UI entirely; see operational-inventory-page.tsx
// for the Distribute/Trash-capable, own-location-only counterpart.
export function AdminInventoryPage() {
  const [page, setPage] = useState(1);
  const [locationFilter, setLocationFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [initializeOpen, setInitializeOpen] = useState(false);
  const [initializeKey, setInitializeKey] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useGetInventoryQuery({
    page,
    locationId: locationFilter || undefined,
    productId: productFilter || undefined,
  });
  const { data: locationsData } = useGetLocationsQuery({ pageSize: 100 });
  const { data: productsData } = useGetProductsQuery({ pageSize: 100 });

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <ManagementPageHeader
        title="Inventory"
        description="Stock across every location. Product + location is not unique — the same pair can appear as several separate records."
        action={
          <Button
            onClick={() => {
              setInitializeKey((key) => key + 1);
              setInitializeOpen(true);
            }}
          >
            Initialize inventory
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={locationFilter || "all"}
          onValueChange={(value) => {
            setLocationFilter(value === "all" ? "" : value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by location">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locationsData?.items.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={productFilter || "all"}
          onValueChange={(value) => {
            setProductFilter(value === "all" ? "" : value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by product">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {productsData?.items.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.code} — {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <PageLoader />}

      {error && <ErrorAlert message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="No inventory records found"
          description="Try a different filter, or initialize inventory for a location."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.product.name}</TableCell>
                  <TableCell>{record.product.code}</TableCell>
                  <TableCell>{record.location.name}</TableCell>
                  <TableCell>{record.location.category}</TableCell>
                  <TableCell>
                    {record.quantity} {record.product.unit}
                  </TableCell>
                  <TableCell>{new Date(record.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationControls
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPageChange={setPage}
          />
        </div>
      )}

      <InitializeInventoryDialog key={initializeKey} open={initializeOpen} onOpenChange={setInitializeOpen} />
    </div>
  );
}
