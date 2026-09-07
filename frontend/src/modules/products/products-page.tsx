import { useState } from "react";

import { ManagementPageHeader } from "@/components/common/management-page-header";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageLoader } from "@/components/common/page-loader";
import { PaginationControls } from "@/components/common/pagination-controls";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { useGetProductsQuery, useUpdateProductMutation } from "./product-api";
import { ProductFormDialog } from "./product-form-dialog";
import type { Product } from "./product-types";

type StatusFilter = "" | "true" | "false";

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [toggleTarget, setToggleTarget] = useState<Product | undefined>(undefined);

  const { data, isLoading, isFetching, error, refetch } = useGetProductsQuery({
    page,
    search: search || undefined,
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
  });
  const [updateProduct, { isLoading: isToggling }] = useUpdateProductMutation();

  function resetToFirstPage() {
    setPage(1);
  }

  function openCreateDialog() {
    setEditingProduct(undefined);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    try {
      await updateProduct({ id: toggleTarget.id, input: { isActive: !toggleTarget.isActive } }).unwrap();
      setToggleTarget(undefined);
    } catch {
      // Leave the dialog open; ConfirmActionDialog has no error slot here
      // because deactivating a product has no invariant that can reject
      // it (see PROJECT_RULES.md) — a failure here is a genuine
      // network/server error, not an expected outcome.
    }
  }

  return (
    <div className="space-y-4">
      <ManagementPageHeader
        title="Products"
        description="Global master data, shared across every location."
        action={<Button onClick={openCreateDialog}>New product</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          placeholder="Search by code or name…"
          className="sm:max-w-xs"
          aria-label="Search products"
        />
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) => {
            setStatusFilter(value === "all" ? "" : (value as StatusFilter));
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <PageLoader />}

      {error && <ErrorAlert message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="No products found"
          description="Try adjusting your search or filters, or create a new product."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>
                    <StatusBadge isActive={product.isActive} />
                  </TableCell>
                  <TableCell>{new Date(product.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(product)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setToggleTarget(product)}>
                        {product.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
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

      <ProductFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} product={editingProduct} />

      {toggleTarget && (
        <ConfirmActionDialog
          open={Boolean(toggleTarget)}
          onOpenChange={(open) => !open && setToggleTarget(undefined)}
          title={toggleTarget.isActive ? "Deactivate product?" : "Activate product?"}
          description={`"${toggleTarget.name}" will be ${
            toggleTarget.isActive ? "deactivated" : "activated"
          }. Existing inventory records referencing it are unaffected.`}
          confirmLabel={toggleTarget.isActive ? "Deactivate" : "Activate"}
          destructive={toggleTarget.isActive}
          isLoading={isToggling}
          onConfirm={confirmToggle}
        />
      )}
    </div>
  );
}
