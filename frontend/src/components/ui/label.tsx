import type * as React from "react";

import { cn } from "@/lib/utils";

// A plain native <label> rather than @radix-ui/react-label (not an
// existing project dependency — see PROJECT_RULES.md on not introducing
// unnecessary dependencies). A native label with `htmlFor` gives full
// input-association accessibility without it.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
