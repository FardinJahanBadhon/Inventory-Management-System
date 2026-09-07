import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/nav-items";

interface SidebarProps {
  items: NavItem[];
}

// Generic, data-driven nav rail — it only knows how to render `NavItem[]`,
// never which categories can see which item. Hidden below `md` for now;
// a collapsible mobile nav is a later concern, not part of this
// foundation.
export function Sidebar({ items }: SidebarProps) {
  return (
    <nav aria-label="Primary" className="hidden w-56 shrink-0 border-r p-4 md:block">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
