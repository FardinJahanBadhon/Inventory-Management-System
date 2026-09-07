import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/nav-items";

interface SidebarProps {
  items: NavItem[];
}

// Generic, data-driven nav rail — it only knows how to render `NavItem[]`,
// never which categories can see which item. Below `md` this renders as a
// horizontally-scrollable bar instead of a vertical rail (there's no room
// for a 224px-wide column next to real content at phone width) — a
// full collapsible/hamburger mobile nav is a larger redesign than this
// warrants; this keeps every route reachable without one.
export function Sidebar({ items }: SidebarProps) {
  return (
    <nav aria-label="Primary" className="w-full shrink-0 border-b p-2 md:w-56 md:border-r md:border-b-0 md:p-4">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:space-y-1 md:overflow-visible">
        {items.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-accent hover:text-accent-foreground",
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
