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
import { useGetLocationsQuery } from "@/modules/locations/location-api";
import { useGetUsersQuery, useUpdateUserMutation } from "./user-api";
import { UserFormDialog } from "./user-form-dialog";
import type { User } from "./user-types";

type StatusFilter = "" | "true" | "false";

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [toggleTarget, setToggleTarget] = useState<User | undefined>(undefined);
  const [toggleErrorMessage, setToggleErrorMessage] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching, error, refetch } = useGetUsersQuery({
    page,
    search: search || undefined,
    locationId: locationFilter || undefined,
    isActive: statusFilter === "" ? undefined : statusFilter === "true",
  });
  const { data: locationsData } = useGetLocationsQuery({ pageSize: 100 });
  const [updateUser, { isLoading: isToggling }] = useUpdateUserMutation();

  function resetToFirstPage() {
    setPage(1);
  }

  function openCreateDialog() {
    setEditingUser(undefined);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    setToggleErrorMessage(undefined);
    try {
      await updateUser({ id: toggleTarget.id, input: { isActive: !toggleTarget.isActive } }).unwrap();
      setToggleTarget(undefined);
    } catch (err) {
      // The "at least one active administrator" invariant (see
      // PROJECT_RULES.md) can reject a deactivation with 409 — surface it
      // instead of silently closing the dialog.
      setToggleErrorMessage(getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0]));
    }
  }

  return (
    <div className="space-y-4">
      <ManagementPageHeader
        title="Users"
        description="Administration-only accounts, assigned to exactly one location each."
        action={<Button onClick={openCreateDialog}>New user</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          placeholder="Search by name or username…"
          className="sm:max-w-xs"
          aria-label="Search users"
        />
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
          title="No users found"
          description="Try adjusting your search or filters, or create a new user."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.location.name}</TableCell>
                  <TableCell>{user.location.category}</TableCell>
                  <TableCell>
                    <StatusBadge isActive={user.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setToggleErrorMessage(undefined);
                          setToggleTarget(user);
                        }}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
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

      <UserFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

      {toggleTarget && (
        <ConfirmActionDialog
          open={Boolean(toggleTarget)}
          onOpenChange={(open) => !open && setToggleTarget(undefined)}
          title={toggleTarget.isActive ? "Deactivate user?" : "Activate user?"}
          description={
            toggleErrorMessage ??
            `"${toggleTarget.name}" will be ${toggleTarget.isActive ? "deactivated" : "activated"}.`
          }
          confirmLabel={toggleTarget.isActive ? "Deactivate" : "Activate"}
          destructive={toggleTarget.isActive}
          isLoading={isToggling}
          onConfirm={confirmToggle}
        />
      )}
    </div>
  );
}
