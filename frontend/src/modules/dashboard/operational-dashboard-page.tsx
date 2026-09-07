import { SummaryCard } from "@/components/common/summary-card";
import { useAuth } from "@/modules/auth/use-auth";
import { useGetInventoryQuery } from "@/modules/inventory/inventory-api";

// No `locationId` is ever passed here — GET /api/inventory already scopes
// an operational caller to their own location server-side (see
// PROJECT_RULES.md's Inventory Management Conventions), so requesting
// "all inventory" and reading its total is exactly "my location's
// inventory count." Client-side filtering would be redundant at best and
// a false sense of security at worst.
export function OperationalDashboardPage() {
  const { user } = useAuth();
  const { data: inventoryData, isLoading } = useGetInventoryQuery({ pageSize: 1 });

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Location"
          isLoading={false}
          value={user?.location.name}
          description={user ? `Category: ${user.location.category}` : "—"}
        />
        <SummaryCard
          title="Inventory records"
          isLoading={isLoading}
          value={inventoryData?.meta.total}
          description="At your location. Product + location is not unique — the same pair can appear as several records."
        />
      </div>
    </div>
  );
}
