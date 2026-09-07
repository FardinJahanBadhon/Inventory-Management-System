import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/use-auth";
import { ROUTES } from "@/routes/paths";

// Top navigation bar for the authenticated app shell (see app-layout.tsx).
export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <h1 className="text-sm font-semibold">Inventory Management System</h1>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {user.name} · {user.location.name} · {user.location.category}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      )}
    </header>
  );
}
