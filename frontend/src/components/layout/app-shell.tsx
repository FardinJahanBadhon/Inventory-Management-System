import type { ReactNode } from "react";

// Minimal layout shell for Phase 2. The real sidebar/header with
// category-aware navigation is built in Phase 11 (Frontend Foundation)
// once authentication exists and there is a session to read a location
// category from.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory Management System</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
