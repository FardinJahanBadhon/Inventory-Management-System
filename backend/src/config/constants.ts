// Shared, non-secret constants used across modules. Environment-derived
// configuration (secrets, connection strings) stays in config/index.ts —
// this file is for fixed values that don't come from the environment.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
