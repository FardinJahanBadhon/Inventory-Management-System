import { useMemo, useState } from "react";

import { ManagementPageHeader } from "@/components/common/management-page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageLoader } from "@/components/common/page-loader";
import { PaginationControls } from "@/components/common/pagination-controls";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { useGetInventoryQuery } from "./inventory-api";
import { DistributeInventoryDialog } from "./distribute-inventory-dialog";
import { TrashInventoryDialog } from "./trash-inventory-dialog";
import type { InventoryProductContext, InventoryRecord } from "./inventory-types";

// Operational counterpart to admin-inventory-page.tsx — one component
// works for STORE, LAB, WARD, and PHARMACY alike (no per-category
// variants) because the backend already scopes the results: no
// `locationId` is ever sent here, so there is nothing for the frontend to
// filter — GET /api/inventory silently forces the scope to the caller's
// own location for every non-ADMINISTRATION category (see
// PROJECT_RULES.md). There is no location picker, no cross-location view,
// and no Initialize action; Distribute and Trash are offered instead.
export function OperationalInventoryPage() {
  const [page, setPage] = useState(1);
  const [productFilter, setProductFilter] = useState("");

  const [distributeTarget, setDistributeTarget] = useState<InventoryRecord | undefined>(undefined);
  const [distributeKey, setDistributeKey] = useState(0);
  const [trashTarget, setTrashTarget] = useState<InventoryRecord | undefined>(undefined);
  const [trashKey, setTrashKey] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useGetInventoryQuery({
    page,
    productId: productFilter || undefined,
  });

  // GET /api/products is Administration-only (Phase 8) — an operational
  // user gets a 403 from it, so the product-filter dropdown's options
  // cannot come from that endpoint. A second, larger, unfiltered fetch of
  // this same (already-permitted) inventory endpoint gives the distinct
  // set of products actually stocked at this location instead.
  const { data: unfilteredInventory } = useGetInventoryQuery({ pageSize: 100 });
  const productOptions = useMemo(() => {
    const byId = new Map<string, InventoryProductContext>();
    for (const record of unfilteredInventory?.items ?? []) {
      byId.set(record.product.id, record.product);
    }
    return Array.from(byId.values());
  }, [unfilteredInventory]);

  function openDistribute(record: InventoryRecord) {
    setDistributeTarget(record);
    setDistributeKey((key) => key + 1);
  }

  function openTrash(record: InventoryRecord) {
    setTrashTarget(record);
    setTrashKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      <ManagementPageHeader
        title="Inventory"
        description="Stock at your location. Product + location is not unique — the same pair can appear as several separate records."
      />

      <Select
        value={productFilter || "all"}
        onValueChange={(value) => {
          setProductFilter(value === "all" ? "" : value);
          setPage(1);
        }}
      >
        <SelectTrigger className="sm:w-56" aria-label="Filter by product">
          <SelectValue placeholder="All products" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All products</SelectItem>
          {productOptions.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.code} — {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && <PageLoader />}

      {error && <ErrorAlert message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="No inventory at your location"
          description="Administration initializes inventory before it appears here."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.product.name}</TableCell>
                  <TableCell>{record.product.code}</TableCell>
                  <TableCell>
                    {record.quantity} {record.product.unit}
                  </TableCell>
                  <TableCell>{new Date(record.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDistribute(record)}
                        disabled={record.quantity <= 0}
                      >
                        Distribute
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTrash(record)}
                        disabled={record.quantity <= 0}
                      >
                        Trash
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

      {distributeTarget && (
        <DistributeInventoryDialog
          key={distributeKey}
          open={Boolean(distributeTarget)}
          onOpenChange={(open) => !open && setDistributeTarget(undefined)}
          record={distributeTarget}
        />
      )}

      {trashTarget && (
        <TrashInventoryDialog
          key={trashKey}
          open={Boolean(trashTarget)}
          onOpenChange={(open) => !open && setTrashTarget(undefined)}
          record={trashTarget}
        />
      )}
    </div>
  );
}
