import { LoadingSpinner } from "@/components/common/loading-spinner";

// Full-page/section loading state for a route whose content depends on a
// query that hasn't resolved yet. Feature modules needing a list-shaped
// loading state should reach for Skeleton (components/ui/skeleton.tsx)
// instead of this.
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
