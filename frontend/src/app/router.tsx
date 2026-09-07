import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AppLayout } from "@/components/layout/app-layout";
import { SystemStatusPage } from "@/pages/system-status-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { UnauthorizedPage } from "@/pages/unauthorized-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { LoginPage } from "@/modules/auth/login-page";
import { RequireAuth } from "@/modules/auth/require-auth";
import { RequireAdministrationAccess } from "@/modules/auth/require-administration-access";
import { RequireOperationalAccess } from "@/modules/auth/require-operational-access";
import { RedirectIfAuthenticated } from "@/modules/auth/redirect-if-authenticated";
import { AdminDashboardPage } from "@/modules/dashboard/admin-dashboard-page";
import { OperationalDashboardPage } from "@/modules/dashboard/operational-dashboard-page";
import { LocationsPage } from "@/modules/locations/locations-page";
import { UsersPage } from "@/modules/users/users-page";
import { ProductsPage } from "@/modules/products/products-page";
import { AdminInventoryPage } from "@/modules/inventory/admin-inventory-page";
import { OperationalInventoryPage } from "@/modules/inventory/operational-inventory-page";
import { ROUTES } from "@/routes/paths";

// /profile is reachable by any authenticated user regardless of category.
// /dashboard, /locations, /users, /products, /inventory are the
// Administration UI (Phase 13), gated by RequireAdministrationAccess.
// /operations/dashboard and /operations/inventory are the Operational UI
// (Phase 14) — a distinct set of routes rather than branching the Admin
// ones by category, gated symmetrically by RequireOperationalAccess. A
// non-matching authenticated user is bounced to /unauthorized by whichever
// guard rejects them; an unauthenticated one never gets past RequireAuth.
export const router = createBrowserRouter([
  {
    path: ROUTES.systemStatus,
    element: (
      <AppShell>
        <SystemStatusPage />
      </AppShell>
    ),
  },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      {
        path: ROUTES.login,
        element: (
          <AppShell>
            <LoginPage />
          </AppShell>
        ),
      },
    ],
  },
  {
    path: ROUTES.unauthorized,
    element: (
      <AppShell>
        <UnauthorizedPage />
      </AppShell>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.profile, element: <PlaceholderPage title="Profile" /> },
          {
            element: <RequireAdministrationAccess />,
            children: [
              { path: ROUTES.dashboard, element: <AdminDashboardPage /> },
              { path: ROUTES.locations, element: <LocationsPage /> },
              { path: ROUTES.users, element: <UsersPage /> },
              { path: ROUTES.products, element: <ProductsPage /> },
              { path: ROUTES.inventory, element: <AdminInventoryPage /> },
            ],
          },
          {
            element: <RequireOperationalAccess />,
            children: [
              { path: ROUTES.operationsDashboard, element: <OperationalDashboardPage /> },
              { path: ROUTES.operationsInventory, element: <OperationalInventoryPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    ),
  },
]);
