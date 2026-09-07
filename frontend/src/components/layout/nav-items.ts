import { OPERATIONAL_LOCATION_CATEGORIES, type LocationCategory } from "@/types/location-category";
import { ROUTES } from "@/routes/paths";

export interface NavItem {
  label: string;
  to: string;
  /** Which location categories should see this item, or "all" for every category. */
  categories: LocationCategory[] | "all";
}

// Phase 13 implements the Administration UI behind /dashboard, /locations,
// /users, /products, and /inventory — all gated to ADMINISTRATION here and
// at the route level (RequireAdministrationAccess, see app/router.tsx).
// Phase 14 adds the operational counterpart at its own /operations/* paths
// (RequireOperationalAccess) rather than branching the same /dashboard
// and /inventory routes by category — the two are different pages with
// different capabilities (no Initialize, no cross-location view; adds
// Distribute/Trash), so a distinct URL per audience keeps the router's
// route-level guards simple and symmetric.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: ROUTES.dashboard, categories: ["ADMINISTRATION"] },
  { label: "Locations", to: ROUTES.locations, categories: ["ADMINISTRATION"] },
  { label: "Users", to: ROUTES.users, categories: ["ADMINISTRATION"] },
  { label: "Products", to: ROUTES.products, categories: ["ADMINISTRATION"] },
  { label: "Inventory", to: ROUTES.inventory, categories: ["ADMINISTRATION"] },
  { label: "Dashboard", to: ROUTES.operationsDashboard, categories: [...OPERATIONAL_LOCATION_CATEGORIES] },
  { label: "Inventory", to: ROUTES.operationsInventory, categories: [...OPERATIONAL_LOCATION_CATEGORIES] },
];

// Never trust a client-supplied category (PROJECT_RULES.md) — `category`
// must come from the authenticated session, which Phase 12 introduces.
// `null` (no session/category known yet) yields no items rather than
// guessing a default.
export function getVisibleNavItems(
  category: LocationCategory | null,
  items: NavItem[] = NAV_ITEMS,
): NavItem[] {
  if (!category) return [];
  return items.filter((item) => item.categories === "all" || item.categories.includes(category));
}
