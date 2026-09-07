import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "size-4",
  default: "size-6",
  lg: "size-8",
};

// Generic spinner reused wherever a loading state is needed — a full page
// (see PageLoader below), a button mid-request, or an inline fetch inside a
// card. Keep this the only spinner implementation in the app.
export function LoadingSpinner({ className, size = "default" }: LoadingSpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("animate-spin text-muted-foreground", SIZE_CLASSES[size], className)}
    />
  );
}
