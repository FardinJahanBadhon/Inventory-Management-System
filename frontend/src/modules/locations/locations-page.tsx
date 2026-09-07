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
import { LOCATION_CATEGORIES, type LocationCategory } from "@/types/location-category";
import { useGetLocationsQuery, useUpdateLocationMutation } from "./location-api";
import { LocationFormDialog } from "./location-form-dialog";
import type { Location } from "./location-types";

type StatusFilter = "" | "true" | "false";

export function LocationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LocationCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingLocation, setEditingLocation] = useState<Location | undefined>(undefined);
  const [toggleTarget, setToggleTarget] = useState<Location | undefined>(undefined);

  const { data, isLoading, isFetching, error, refetch } = useGetLocationsQuery({
    page,
    search: search || undefined,
    category: categoryFilter || undefined,
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
  });
  const [updateLocation, { isLoading: isToggling }] = useUpdateLocationMutation();

  function resetToFirstPage() {
    setPage(1);
  }

  function openCreateDialog() {
    setEditingLocation(undefined);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function openEditDialog(location: Location) {
    setEditingLocation(location);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    try {
      await updateLocation({ id: toggleTarget.id, input: { isActive: !toggleTarget.isActive } }).unwrap();
      setToggleTarget(undefined);
    } catch {
      // Leave the dialog open with the mutation's own error state so the
      // admin sees why it failed rather than having it silently vanish.
    }
  }

  return (
    <div className="space-y-4">
      <ManagementPageHeader
        title="Locations"
        description="Administration-only master data for every physical location."
        action={<Button onClick={openCreateDialog}>New location</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          placeholder="Search by name…"
          className="sm:max-w-xs"
          aria-label="Search locations"
        />
        <Select
          value={categoryFilter || "all"}
          onValueChange={(value) => {
            setCategoryFilter(value === "all" ? "" : (value as LocationCategory));
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {LOCATION_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          title="No locations found"
          description="Try adjusting your search or filters, or create a new location."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    {location.name}
                    {location.category === "ADMINISTRATION" && (
                      <span className="text-muted-foreground ml-2 text-xs">(Administration Office)</span>
                    )}
                  </TableCell>
                  <TableCell>{location.category}</TableCell>
                  <TableCell>
                    <StatusBadge isActive={location.isActive} />
                  </TableCell>
                  <TableCell>{new Date(location.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(location)}>
                        Edit
                      </Button>
                      {location.category !== "ADMINISTRATION" && (
                        <Button variant="outline" size="sm" onClick={() => setToggleTarget(location)}>
                          {location.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
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

      <LocationFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} location={editingLocation} />

      {toggleTarget && (
        <ConfirmActionDialog
          open={Boolean(toggleTarget)}
          onOpenChange={(open) => !open && setToggleTarget(undefined)}
          title={toggleTarget.isActive ? "Deactivate location?" : "Activate location?"}
          description={`"${toggleTarget.name}" will be ${
            toggleTarget.isActive ? "deactivated" : "activated"
          }. This can be reversed later.`}
          confirmLabel={toggleTarget.isActive ? "Deactivate" : "Activate"}
          destructive={toggleTarget.isActive}
          isLoading={isToggling}
          onConfirm={confirmToggle}
        />
      )}
    </div>
  );
}
