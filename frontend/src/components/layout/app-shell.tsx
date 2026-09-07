import type { ReactNode } from "react";

// Minimal public/unauthenticated layout — used for routes that exist
// outside the authenticated app shell (system status, login, unauthorized,
// not-found). The authenticated shell with header + category-aware
// sidebar is app-layout.tsx.
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
