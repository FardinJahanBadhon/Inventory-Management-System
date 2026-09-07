import { Outlet } from "react-router-dom";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { useAuth } from "@/modules/auth/use-auth";

// Authenticated app shell: header + category-aware sidebar + routed
// content. Only reachable behind RequireAuth (see app/router.tsx), so a
// session is guaranteed to exist here.
export function AppLayout() {
  const { locationCategory } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar items={getVisibleNavItems(locationCategory)} />
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
