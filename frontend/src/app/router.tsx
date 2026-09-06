import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { SystemStatusPage } from "@/pages/system-status-page";
import { ROUTES } from "@/routes/paths";

// Protected-route wrapping (redirect to /login when unauthenticated,
// redirect to /forbidden on a category mismatch) is added in Phase 11
// once the auth module exists. For now there is a single public route
// used to verify the frontend foundation.
export const router = createBrowserRouter([
  {
    path: ROUTES.systemStatus,
    element: (
      <AppShell>
        <SystemStatusPage />
      </AppShell>
    ),
  },
]);
