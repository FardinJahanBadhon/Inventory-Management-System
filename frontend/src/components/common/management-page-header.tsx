import type { ReactNode } from "react";

interface ManagementPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

// Consistent header for every Administration list page (Locations, Users,
// Products, Inventory): title + description on the left, one primary
// action (usually "New …") on the right.
export function ManagementPageHeader({ title, description, action }: ManagementPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
