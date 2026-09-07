import { Link } from "react-router-dom";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/routes/paths";

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        title="You don't have access to this page"
        description="Your account's location category doesn't permit viewing this screen."
        action={
          <Button asChild size="sm">
            <Link to={ROUTES.systemStatus}>Go home</Link>
          </Button>
        }
      />
    </div>
  );
}
