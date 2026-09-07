import { SummaryCard } from "@/components/common/summary-card";
import { useAuth } from "@/modules/auth/use-auth";
import { useGetLocationsQuery } from "@/modules/locations/location-api";
import { useGetUsersQuery } from "@/modules/users/user-api";
import { useGetProductsQuery } from "@/modules/products/product-api";
import { useGetInventoryQuery } from "@/modules/inventory/inventory-api";

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { data: locationsData, isLoading: isLoadingLocations } = useGetLocationsQuery({ pageSize: 1 });
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsersQuery({ pageSize: 1 });
  const { data: productsData, isLoading: isLoadingProducts } = useGetProductsQuery({ pageSize: 1 });
  const { data: inventoryData, isLoading: isLoadingInventory } = useGetInventoryQuery({ pageSize: 1 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        {user && (
          <p className="text-muted-foreground text-sm">
            Signed in as {user.name} · {user.location.name} ({user.location.category})
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Locations"
          isLoading={isLoadingLocations}
          value={locationsData?.meta.total}
          description="Active and inactive, across all categories."
        />
        <SummaryCard
          title="Users"
          isLoading={isLoadingUsers}
          value={usersData?.meta.total}
          description="Administration and operational accounts."
        />
        <SummaryCard
          title="Products"
          isLoading={isLoadingProducts}
          value={productsData?.meta.total}
          description="Global master data, all locations."
        />
        <SummaryCard
          title="Inventory records"
          isLoading={isLoadingInventory}
          value={inventoryData?.meta.total}
          description="Individual records — product + location is not unique."
        />
      </div>
    </div>
  );
}
