// Central route path constants. Feature modules and the router both import
// from here so a path never needs to be typed as a raw string in two places.
export const ROUTES = {
  systemStatus: "/",
  login: "/login",
  dashboard: "/dashboard",
  locations: "/locations",
  users: "/users",
  products: "/products",
  inventory: "/inventory",
  profile: "/profile",
  unauthorized: "/unauthorized",
  operationsDashboard: "/operations/dashboard",
  operationsInventory: "/operations/inventory",
} as const;
