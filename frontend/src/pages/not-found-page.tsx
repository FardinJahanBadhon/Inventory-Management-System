import { Link } from "react-router-dom";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/routes/paths";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button asChild size="sm">
            <Link to={ROUTES.systemStatus}>Go home</Link>
          </Button>
        }
      />
    </div>
  );
}
